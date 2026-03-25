import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type {
  ExecutionRecord,
  TaskAssignment,
  TaskExecutionMode,
  WorkflowPlan,
} from '../shared/task-types';

export interface SerialWorkflowBundle {
  workflowPlan: WorkflowPlan;
  assignments: TaskAssignment[];
}

export type ExecutionLifecycleRecord = ExecutionRecord;

function createSerialWorkflowBundle(input: {
  taskId: string;
  title: string;
  primaryRole: string;
}): SerialWorkflowBundle {
  const now = new Date().toISOString();
  const workflowPlanId = randomUUID();
  const firstAssignmentId = randomUUID();
  const secondAssignmentId = randomUUID();
  const firstStepId = randomUUID();
  const secondStepId = randomUUID();

  return {
    workflowPlan: {
      id: workflowPlanId,
      taskId: input.taskId,
      mode: 'serial',
      synthesisRequired: true,
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          id: firstStepId,
          order: 1,
          title: `Draft ${input.title}`,
          assignmentId: firstAssignmentId,
          agentId: input.primaryRole,
          assignmentRole: 'primary',
          status: 'pending',
        },
        {
          id: secondStepId,
          order: 2,
          title: `Review and finalize ${input.title}`,
          assignmentId: secondAssignmentId,
          agentId: 'dispatcher',
          assignmentRole: 'dispatcher',
          status: 'pending',
        },
      ],
    },
    assignments: [
      {
        id: firstAssignmentId,
        taskId: input.taskId,
        workflowPlanId,
        stepId: firstStepId,
        agentId: input.primaryRole,
        assignmentRole: 'primary',
        status: 'pending',
      },
      {
        id: secondAssignmentId,
        taskId: input.taskId,
        workflowPlanId,
        stepId: secondStepId,
        agentId: 'dispatcher',
        assignmentRole: 'dispatcher',
        status: 'pending',
      },
    ],
  };
}

function completeSerialWorkflowBundle(bundle: SerialWorkflowBundle): SerialWorkflowBundle {
  const completedAt = new Date().toISOString();

  return {
    workflowPlan: {
      ...bundle.workflowPlan,
      status: 'completed',
      updatedAt: completedAt,
      steps: bundle.workflowPlan.steps.map((step) => ({
        ...step,
        status: 'completed',
      })),
    },
    assignments: bundle.assignments.map((assignment) => ({
      ...assignment,
      status: 'completed',
      startedAt: assignment.startedAt ?? completedAt,
      endedAt: completedAt,
      completedAt,
    })),
  };
}

function completeWorkflowArtifacts(input: {
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}): { workflowPlan?: WorkflowPlan; assignments?: TaskAssignment[] } {
  if (!input.workflowPlan || !input.assignments || input.assignments.length === 0) {
    return {};
  }

  const completedAt = new Date().toISOString();
  const assignments = input.assignments.map((assignment) => ({
    ...assignment,
    status: 'completed' as const,
    startedAt: assignment.startedAt ?? completedAt,
    endedAt: completedAt,
    completedAt,
    updatedAt: completedAt,
  }));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));

  return {
    assignments,
    workflowPlan: {
      ...input.workflowPlan,
      status: 'completed',
      updatedAt: completedAt,
      steps: input.workflowPlan.steps.map((step) => ({
        ...step,
        status: assignmentIds.has(step.assignmentId) ? 'completed' : step.status,
      })),
    },
  };
}

export function buildSerialWorkflowPlan(input: {
  id: string;
  title: string;
  description: string;
  executionMode: 'serial';
  recommendedAgentRole: string;
}): SerialWorkflowBundle {
  return createSerialWorkflowBundle({
    taskId: input.id,
    title: input.title,
    primaryRole: input.recommendedAgentRole || 'software-architect',
  });
}

export async function runTaskExecution(
  input: {
    taskId: string;
    executor: 'claude' | 'codex' | 'openai';
    summary: string;
    memoryContextExcerpt?: string;
    executionMode?: TaskExecutionMode;
    workflowPlan?: WorkflowPlan;
    assignments?: TaskAssignment[];
    taskTitle?: string;
    recommendedAgentRole?: string;
  },
  store: Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'> &
    Partial<Pick<Store, 'saveTaskAssignment' | 'updateTaskAssignment' | 'saveWorkflowPlan' | 'updateWorkflowPlan'>>
): Promise<{
  execution: ExecutionLifecycleRecord;
  task: Awaited<ReturnType<Store['updateTask']>>;
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}> {
  const serialBundle =
    input.executionMode === 'serial'
      ? input.workflowPlan && input.assignments
        ? {
            workflowPlan: input.workflowPlan,
            assignments: input.assignments,
          }
        : buildSerialWorkflowPlan({
            id: input.taskId,
            title: input.taskTitle ?? input.taskId,
            description: input.summary,
            executionMode: 'serial',
            recommendedAgentRole: input.recommendedAgentRole ?? 'software-architect',
          })
      : undefined;
  const completedWorkflowArtifacts =
    serialBundle ??
    (input.workflowPlan && input.assignments
      ? completeWorkflowArtifacts({
          workflowPlan: input.workflowPlan,
          assignments: input.assignments,
        })
      : undefined);
  const started = beginExecution({
    taskId: input.taskId,
    executor: input.executor,
    memoryContextExcerpt: input.memoryContextExcerpt,
    workflowPlan: completedWorkflowArtifacts?.workflowPlan,
    assignments: completedWorkflowArtifacts?.assignments,
  });

  await store.saveExecution(started);
  const finalizedWorkflowArtifacts = serialBundle
    ? completeSerialWorkflowBundle(serialBundle)
    : completedWorkflowArtifacts;
  const completed = finalizedWorkflowArtifacts
    ? completeExecution(started, {
        summary: input.summary,
        workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
        assignments: finalizedWorkflowArtifacts.assignments,
      })
    : completeExecution(started, { summary: input.summary });
  await store.updateExecution(started.id, () => completed);

  if (finalizedWorkflowArtifacts?.workflowPlan && finalizedWorkflowArtifacts.assignments) {
    if (store.updateWorkflowPlan) {
      const updatedPlan = await store.updateWorkflowPlan(input.taskId, () => finalizedWorkflowArtifacts.workflowPlan!);
      if (!updatedPlan && store.saveWorkflowPlan) {
        await store.saveWorkflowPlan(finalizedWorkflowArtifacts.workflowPlan);
      }
    } else if (store.saveWorkflowPlan) {
      await store.saveWorkflowPlan(finalizedWorkflowArtifacts.workflowPlan);
    }

    for (const assignment of finalizedWorkflowArtifacts.assignments) {
      if (store.updateTaskAssignment) {
        const updatedAssignment = await store.updateTaskAssignment(assignment.id, () => assignment);
        if (!updatedAssignment && store.saveTaskAssignment) {
          await store.saveTaskAssignment(assignment);
        }
      } else if (store.saveTaskAssignment) {
        await store.saveTaskAssignment(assignment);
      }
    }
  }

  const task = await store.updateTask(input.taskId, (currentTask) => ({
    ...currentTask,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  }));

  return {
    execution: completed,
    task,
    ...(finalizedWorkflowArtifacts
      ? {
          workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
          assignments: finalizedWorkflowArtifacts.assignments,
        }
      : {}),
  };
}

export function beginExecution(input: {
  taskId: string;
  executor: 'claude' | 'codex' | 'openai';
  memoryContextExcerpt?: string;
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}): ExecutionLifecycleRecord {
  return {
    id: randomUUID(),
    taskId: input.taskId,
    status: 'pending',
    executor: input.executor,
    memoryContextExcerpt: input.memoryContextExcerpt,
    startedAt: new Date().toISOString(),
    ...(input.workflowPlan ? { workflowPlan: input.workflowPlan } : {}),
    ...(input.assignments ? { assignments: input.assignments } : {}),
  };
}

export function completeExecution(
  execution: ExecutionLifecycleRecord,
  input: {
    summary: string;
    workflowPlan?: WorkflowPlan;
    assignments?: TaskAssignment[];
  }
): ExecutionLifecycleRecord {
  return {
    ...execution,
    status: 'completed',
    outputSummary: input.summary,
    completedAt: new Date().toISOString(),
    ...(input.workflowPlan ? { workflowPlan: input.workflowPlan } : {}),
    ...(input.assignments ? { assignments: input.assignments } : {}),
  };
}

export function failExecution(
  execution: ExecutionLifecycleRecord,
  input: { errorMessage: string }
): ExecutionLifecycleRecord {
  return {
    ...execution,
    status: 'failed',
    errorMessage: input.errorMessage,
    completedAt: new Date().toISOString(),
  };
}
