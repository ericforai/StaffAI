import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import { buildSerialWorkflowPlan, runTaskExecution } from '../runtime/execution-service';
import { runAdvancedDiscussionExecution } from '../runtime/advanced-discussion-runner';
import { buildDispatcherDirective } from '../runtime/dispatcher-runtime';
import type { TaskAssignment, TaskExecutionMode, TaskRecord, WorkflowPlan } from '../shared/task-types';
import { resolveExecutionDecision, type SessionCapabilities } from '../execution-strategy';
import { createAssignmentExecutor } from './assignment-executor';

interface ExecuteTaskInput {
  executor: 'claude' | 'codex' | 'openai';
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
  executor: 'claude' | 'codex' | 'openai';
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
    const results = await Promise.all(
      steps.map(async (step) => {
        const assignment = input.assignments.find((a) => a.id === step.assignmentId);
        if (!assignment) {
          failed = true;
          return;
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
        }
      })
    );
    void results;
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

function upgradeToSerialBundle(
  task: TaskRecord,
  workflowPlan: WorkflowPlan | null,
  assignments: TaskAssignment[]
): {
  workflowPlan: WorkflowPlan;
  assignments: TaskAssignment[];
} {
  if (workflowPlan?.mode === 'serial' && assignments.length > 0) {
    return {
      workflowPlan,
      assignments,
    };
  }

  const fallbackBundle = buildSerialWorkflowPlan({
    id: task.id,
    title: task.title,
    description: task.description,
    executionMode: 'serial',
    recommendedAgentRole: task.recommendedAgentRole,
  });

  const now = new Date().toISOString();
  const primaryAssignment = assignments[0];
  const dispatcherAssignment = assignments.find((assignment) => assignment.assignmentRole === 'dispatcher');
  const firstStepId = workflowPlan?.steps[0]?.id ?? primaryAssignment?.stepId ?? randomUUID();
  const secondStepId = dispatcherAssignment?.stepId ?? randomUUID();
  const workflowPlanId = workflowPlan?.id ?? fallbackBundle.workflowPlan.id;

  return {
    workflowPlan: {
      id: workflowPlanId,
      taskId: task.id,
      mode: 'serial' as const,
      synthesisRequired: true,
      status: 'planned' as const,
      createdAt: workflowPlan?.createdAt ?? now,
      updatedAt: now,
      steps: [
        {
          id: firstStepId,
          order: 1,
          title: `Draft ${task.title}`,
          assignmentId: primaryAssignment?.id ?? fallbackBundle.assignments[0].id,
          agentId: task.recommendedAgentRole,
          assignmentRole: 'primary' as const,
          status: 'pending' as const,
        },
        {
          id: secondStepId,
          order: 2,
          title: `Review and finalize ${task.title}`,
          assignmentId: dispatcherAssignment?.id ?? fallbackBundle.assignments[1].id,
          agentId: 'dispatcher',
          assignmentRole: 'dispatcher' as const,
          status: 'pending' as const,
        },
      ],
    },
    assignments: [
      {
        ...(primaryAssignment ?? fallbackBundle.assignments[0]),
        taskId: task.id,
        workflowPlanId,
        stepId: firstStepId,
        agentId: task.recommendedAgentRole,
        assignmentRole: 'primary' as const,
        status: 'pending' as const,
        createdAt: primaryAssignment?.createdAt ?? now,
        updatedAt: now,
      },
      {
        ...(dispatcherAssignment ?? fallbackBundle.assignments[1]),
        taskId: task.id,
        workflowPlanId,
        stepId: secondStepId,
        agentId: 'dispatcher',
        assignmentRole: 'dispatcher' as const,
        status: 'pending' as const,
        createdAt: dispatcherAssignment?.createdAt ?? now,
        updatedAt: now,
      },
    ],
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
  const timeoutMs = Number.isFinite(input.timeoutMs) && (input.timeoutMs ?? 0) > 0 ? (input.timeoutMs as number) : 30_000;
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
