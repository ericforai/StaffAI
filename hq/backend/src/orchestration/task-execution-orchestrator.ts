import type { Store } from '../store';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import { runTaskExecution } from '../runtime/execution-service';
import { runAdvancedDiscussionExecution } from '../runtime/advanced-discussion-runner';
import { buildDispatcherDirective } from '../runtime/dispatcher-runtime';
import { resolveTaskTimeoutMs } from '../runtime/task-execution-config';
import type { TaskAssignment, TaskExecutionMode, TaskRecord, WorkflowPlan } from '../shared/task-types';
import { resolveExecutionDecision, type SessionCapabilities } from '../execution-strategy';
import { createAssignmentExecutor } from './assignment-executor';
import { rebuildWorkflowBundleForSerialExecution } from './task-orchestrator';

interface ExecuteTaskInput {
  executor: 'claude' | 'codex' | 'openai' | 'deerflow';
  summary: string;
  executionMode?: TaskExecutionMode;
  timeoutMs?: number;
  maxRetries?: number;
}

interface TaskExecutionDependencies {
  runAdvancedDiscussion?: (task: TaskRecord) => Promise<{ summary: string }>;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined | void> | string | undefined | void;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionLifecycleRecord) => Promise<void> | void;
  sessionCapabilities?: SessionCapabilities;
}

type TaskExecutionStore = Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'> &
  Partial<
    Pick<
      Store,
      | 'getTaskAssignmentsByTaskId'
      | 'getWorkflowPlanByTaskId'
      | 'getTaskById'
      | 'saveTaskAssignment'
      | 'updateTaskAssignment'
      | 'saveWorkflowPlan'
      | 'updateWorkflowPlan'
      | 'logAudit'
      | 'getTaskAssignmentById'
    >
  >;

type AssignmentExecutorStore = Pick<Store, 'getTaskById' | 'updateTaskAssignment' | 'saveExecution' | 'logAudit'>;

function hasAssignmentExecutorStore(store: TaskExecutionStore): store is TaskExecutionStore & AssignmentExecutorStore {
  return (
    typeof store.getTaskById === 'function' &&
    typeof store.updateTaskAssignment === 'function' &&
    typeof store.saveExecution === 'function' &&
    typeof store.logAudit === 'function'
  );
}

async function runWorkflowPlanWithAssignments(input: {
  task: TaskRecord;
  workflowPlan: WorkflowPlan;
  assignments: TaskAssignment[];
  executor: 'claude' | 'codex' | 'openai' | 'deerflow';
  timeoutMs: number;
  maxRetries: number;
  memoryContextExcerpt?: string;
  store: TaskExecutionStore;
}): Promise<{ outputSummary: string; outputSnapshot?: Record<string, unknown> }> {
  const { task, workflowPlan, executor, timeoutMs, maxRetries, memoryContextExcerpt, store } = input;

  if (
    !store.updateWorkflowPlan ||
    !store.getTaskAssignmentsByTaskId ||
    !hasAssignmentExecutorStore(store)
  ) {
    return {
      outputSummary: task.description,
    };
  }

  const assignmentExecutor = createAssignmentExecutor({
    store,
    auditLogger: null,
    executor,
    timeoutMs,
  });

  await store.updateWorkflowPlan(task.id, (current) => ({
    ...current,
    status: 'running',
    updatedAt: new Date().toISOString(),
  }));

  const steps = [...workflowPlan.steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let failed = false;
  if (workflowPlan.mode === 'parallel') {
    const stepsByOrder = new Map<number, WorkflowPlan['steps']>();
    for (const step of steps) {
      const ord = step.order ?? 1;
      const group = stepsByOrder.get(ord) ?? [];
      group.push(step);
      stepsByOrder.set(ord, group);
    }
    const sortedOrders = Array.from(stepsByOrder.keys()).sort((a, b) => a - b);
    phaseLoop: for (const order of sortedOrders) {
      const group = stepsByOrder.get(order)!;
      const results = await Promise.all(
        group.map(async (step) => {
          const assignment = input.assignments.find((a) => a.id === step.assignmentId);
          if (!assignment) {
            return false;
          }
          const result = await assignmentExecutor.execute(assignment, {
            taskId: task.id,
            title: task.title,
            description: step.description ?? step.title,
            executor,
            timeoutMs,
            maxRetries,
            memoryContextExcerpt,
          });
          return result.status !== 'failed';
        }),
      );
      if (results.some((ok) => !ok)) {
        failed = true;
        break phaseLoop;
      }
    }
  } else {
    for (const step of steps) {
      const assignment = input.assignments.find((a) => a.id === step.assignmentId);
      if (!assignment) {
        failed = true;
        break;
      }
      const result = await assignmentExecutor.execute(assignment, {
        taskId: task.id,
        title: task.title,
        description: step.description ?? step.title,
        executor,
        timeoutMs,
        maxRetries,
        memoryContextExcerpt,
      });
      if (result.status === 'failed') {
        failed = true;
        break;
      }
    }
  }

  await store.updateWorkflowPlan(task.id, (current) => ({
    ...current,
    status: failed ? 'failed' : 'completed',
    updatedAt: new Date().toISOString(),
  }));

  const updatedAssignments = await store.getTaskAssignmentsByTaskId(task.id);
  const byId = new Map(updatedAssignments.map((a) => [a.id, a]));
  const lines: string[] = [];
  for (const step of steps) {
    const assignment = byId.get(step.assignmentId);
    const label = step.title || step.id;
    const status = assignment?.status ?? 'unknown';
    const summary = assignment?.resultSummary ?? assignment?.errorMessage ?? '';
    lines.push(`- [${status}] ${label}${summary ? `: ${summary}` : ''}`);
  }

  return {
    outputSummary: lines.join('\n'),
    outputSnapshot: {
      workflowPlanId: workflowPlan.id,
      mode: workflowPlan.mode,
      failed,
    },
  };
}

async function ensureWorkflowBundlePersisted(
  store: TaskExecutionStore,
  task: TaskRecord,
  bundle: { workflowPlan: WorkflowPlan; assignments: TaskAssignment[] },
): Promise<void> {
  if (!store.saveWorkflowPlan || !store.saveTaskAssignment || !store.getTaskAssignmentById) {
    return;
  }

  if (store.updateWorkflowPlan && store.getWorkflowPlanByTaskId) {
    const previous = await store.getWorkflowPlanByTaskId(task.id);
    if (previous) {
      await store.updateWorkflowPlan(task.id, () => ({
        ...bundle.workflowPlan,
        createdAt: bundle.workflowPlan.createdAt ?? previous.createdAt,
        updatedAt: new Date().toISOString(),
      }));
    } else {
      await store.saveWorkflowPlan(bundle.workflowPlan);
    }
  } else {
    await store.saveWorkflowPlan(bundle.workflowPlan);
  }

  for (const assignment of bundle.assignments) {
    const existing = await store.getTaskAssignmentById(assignment.id);
    if (!existing) {
      await store.saveTaskAssignment(assignment);
    }
  }
}

function upgradeToSerialBundle(
  task: TaskRecord,
  workflowPlan: WorkflowPlan | null,
  assignments: TaskAssignment[],
): {
  workflowPlan: WorkflowPlan;
  assignments: TaskAssignment[];
  bundleWasRebuilt: boolean;
} {
  const planCoherent =
    Boolean(workflowPlan) &&
    workflowPlan!.mode === 'serial' &&
    assignments.length > 0 &&
    assignments.length === workflowPlan!.steps.length &&
    workflowPlan!.steps.every((step) => assignments.some((a) => a.id === step.assignmentId));

  if (planCoherent && workflowPlan) {
    return {
      workflowPlan,
      assignments,
      bundleWasRebuilt: false,
    };
  }

  const rebuilt = rebuildWorkflowBundleForSerialExecution(task, []);
  return {
    workflowPlan: rebuilt.workflowPlan,
    assignments: rebuilt.assignments,
    bundleWasRebuilt: true,
  };
}

export async function executeTaskRecord(
  task: TaskRecord,
  input: ExecuteTaskInput,
  store: TaskExecutionStore,
  dependencies: TaskExecutionDependencies = {}
): Promise<{
  mode: TaskRecord['executionMode'];
  execution: ExecutionLifecycleRecord;
  task: TaskRecord | null;
  workflowPlan?: ExecutionLifecycleRecord['workflowPlan'];
  assignments?: ExecutionLifecycleRecord['assignments'];
}> {
  const loadedMemoryContext = await dependencies.loadMemoryContext?.(task);
  const memoryContextExcerpt =
    typeof loadedMemoryContext === 'string' && loadedMemoryContext.trim()
      ? loadedMemoryContext
      : undefined;
  const requestedMode = input.executionMode ?? task.executionMode;
  const timeoutMs = resolveTaskTimeoutMs(input.timeoutMs);
  const maxRetries = Number.isFinite(input.maxRetries) && (input.maxRetries ?? 0) >= 0 ? (input.maxRetries as number) : 1;
  const sessionCapabilities = dependencies.sessionCapabilities ?? { sampling: false };
  const parallelDecision =
    requestedMode === 'parallel'
      ? resolveExecutionDecision(sessionCapabilities, 'auto')
      : {
          appliedMode: requestedMode,
          degraded: false,
          notice: undefined,
        };
  const appliedMode =
    requestedMode === 'parallel'
      ? (parallelDecision.appliedMode === 'parallel' ? 'parallel' : 'serial')
      : requestedMode;
  const degraded = requestedMode === 'parallel' ? parallelDecision.degraded : false;
  const dispatcherDirective = buildDispatcherDirective({
    task,
    requestedMode,
    appliedMode,
    degraded,
  });

  if (appliedMode === 'advanced_discussion') {
    const advancedResult = await runAdvancedDiscussionExecution(
      task,
      input.executor,
      store,
      dependencies.runAdvancedDiscussion
    );

    if (advancedResult.execution.status === 'completed') {
      await dependencies.writeExecutionSummary?.(advancedResult.task ?? task, advancedResult.execution);
    }

    return {
      mode: 'advanced_discussion',
      execution: advancedResult.execution,
      task: advancedResult.task ?? task,
    };
  }

  if (appliedMode === 'serial') {
    const existingWorkflowPlan = store.getWorkflowPlanByTaskId
      ? await store.getWorkflowPlanByTaskId(task.id)
      : null;
    const existingAssignments = store.getTaskAssignmentsByTaskId
      ? await store.getTaskAssignmentsByTaskId(task.id)
      : [];
    const serialBundle = upgradeToSerialBundle(task, existingWorkflowPlan, existingAssignments);
    if (serialBundle.bundleWasRebuilt) {
      await ensureWorkflowBundlePersisted(store, task, {
        workflowPlan: serialBundle.workflowPlan,
        assignments: serialBundle.assignments,
      });
    }
    const result = await runTaskExecution(
      {
        taskId: task.id,
        executor: input.executor,
        summary: input.summary,
        memoryContextExcerpt,
        executionMode: 'serial',
        task,
        timeoutMs,
        maxRetries,
        degraded,
        runtimeRunner: async () =>
          runWorkflowPlanWithAssignments({
            task,
            workflowPlan: serialBundle.workflowPlan,
            assignments: serialBundle.assignments,
            executor: input.executor,
            timeoutMs,
            maxRetries,
            memoryContextExcerpt,
            store,
          }),
        inputSnapshot: {
          dispatcherDirective,
          executionNotice: parallelDecision.notice,
          requestedMode,
          appliedMode: 'serial',
        },
        workflowPlan: serialBundle.workflowPlan,
        assignments: serialBundle.assignments,
      },
      store
    );

    await dependencies.writeExecutionSummary?.(task, result.execution);

    return {
      mode: requestedMode,
      ...result,
    };
  }

  const existingWorkflowPlan = store.getWorkflowPlanByTaskId
    ? await store.getWorkflowPlanByTaskId(task.id)
    : null;
  const existingAssignments = store.getTaskAssignmentsByTaskId
    ? await store.getTaskAssignmentsByTaskId(task.id)
    : [];

  const result = await runTaskExecution(
    {
      taskId: task.id,
      executor: input.executor,
      summary: input.summary,
      memoryContextExcerpt,
      executionMode: appliedMode,
      task,
      timeoutMs,
      maxRetries,
      degraded,
      runtimeRunner:
        appliedMode === 'parallel' && existingWorkflowPlan && existingAssignments.length > 0
          ? async () =>
              runWorkflowPlanWithAssignments({
                task,
                workflowPlan: existingWorkflowPlan,
                assignments: existingAssignments,
                executor: input.executor,
                timeoutMs,
                maxRetries,
                memoryContextExcerpt,
                store,
              })
          : undefined,
      inputSnapshot: {
        dispatcherDirective,
        executionNotice: parallelDecision.notice,
        requestedMode,
        appliedMode,
      },
      workflowPlan: existingWorkflowPlan ?? undefined,
      assignments: existingAssignments.length > 0 ? existingAssignments : undefined,
    },
    store
  );

  await dependencies.writeExecutionSummary?.(task, result.execution);

  return {
    mode: requestedMode,
    ...result,
  };
}
