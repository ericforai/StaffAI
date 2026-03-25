import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import { buildSerialWorkflowPlan, runTaskExecution } from '../runtime/execution-service';
import { runAdvancedDiscussionExecution } from '../runtime/advanced-discussion-runner';
import type { TaskAssignment, TaskExecutionMode, TaskRecord, WorkflowPlan } from '../shared/task-types';

interface ExecuteTaskInput {
  executor: 'claude' | 'codex' | 'openai';
  summary: string;
  executionMode?: TaskExecutionMode;
}

interface TaskExecutionDependencies {
  runAdvancedDiscussion?: (task: TaskRecord) => Promise<{ summary: string }>;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined | void> | string | undefined | void;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionLifecycleRecord) => Promise<void> | void;
}

type TaskExecutionStore = Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'> &
  Partial<
    Pick<
      Store,
      | 'getTaskAssignmentsByTaskId'
      | 'getWorkflowPlanByTaskId'
      | 'saveTaskAssignment'
      | 'updateTaskAssignment'
      | 'saveWorkflowPlan'
      | 'updateWorkflowPlan'
    >
  >;

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

  if (requestedMode === 'advanced_discussion') {
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

  if (requestedMode === 'serial') {
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
        workflowPlan: serialBundle.workflowPlan,
        assignments: serialBundle.assignments,
      },
      store
    );

    await dependencies.writeExecutionSummary?.(task, result.execution);

    return {
      mode: 'serial',
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
      executionMode: requestedMode,
      workflowPlan: existingWorkflowPlan ?? undefined,
      assignments: existingAssignments.length > 0 ? existingAssignments : undefined,
    },
    store
  );

  await dependencies.writeExecutionSummary?.(task, result.execution);

  return {
    mode: task.executionMode,
    ...result,
  };
}
