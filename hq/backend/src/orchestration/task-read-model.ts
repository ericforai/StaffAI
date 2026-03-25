import type {
  ApprovalRecord,
  ApprovalStatus,
  ExecutionRecord,
  TaskAssignment,
  TaskRecord,
  TaskStatus,
  WorkflowPlan,
} from '../shared/task-types';

type Awaitable<T> = T | Promise<T>;

export interface TaskListReadStore {
  getTasks(): Awaitable<TaskRecord[]>;
  getApprovalsByTaskId?(taskId: string): Awaitable<ApprovalRecord[]>;
  getExecutionsByTaskId?(taskId: string): Awaitable<ExecutionRecord[]>;
}

export interface TaskListItem extends TaskRecord {
  latestApproval: ApprovalRecord | null;
  latestExecution: ExecutionRecord | null;
  canExecute: boolean;
}

export interface TaskDetailReadStore {
  getTaskById(taskId: string): Awaitable<TaskRecord | null>;
  getApprovalsByTaskId(taskId: string): Awaitable<ApprovalRecord[]>;
  getExecutionsByTaskId(taskId: string): Awaitable<ExecutionRecord[]>;
  getTaskAssignmentsByTaskId?(taskId: string): Awaitable<TaskAssignment[]>;
  getWorkflowPlanByTaskId?(taskId: string): Awaitable<WorkflowPlan | null>;
}

export interface TaskDetailReadModel {
  task: TaskRecord;
  approvals: ApprovalRecord[];
  executions: ExecutionRecord[];
  assignments: TaskAssignment[];
  workflowPlan: WorkflowPlan | null;
  summary: TaskDetailSummary;
}

export interface TaskWorkspaceSummary {
  totalTasks: number;
  statusCounts: Record<TaskStatus, number>;
  approvalRequiredTasks: number;
  readyForExecutionTasks: number;
  waitingApprovalTasks: number;
  activeTasks: number;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
}

export interface TaskDetailSummary {
  approvalCounts: Record<ApprovalStatus, number>;
  executionCount: number;
  latestExecutionStatus: ExecutionRecord['status'] | null;
  latestExecutionAt: string | null;
  latestApprovalAt: string | null;
  approvalRequired: boolean;
  taskStatus: TaskStatus;
}

function sortByNewestTimestamp<T extends { createdAt?: string; requestedAt?: string; completedAt?: string; startedAt?: string }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(
      left.completedAt || left.requestedAt || left.createdAt || left.startedAt || '1970-01-01T00:00:00.000Z',
    );
    const rightTime = Date.parse(
      right.completedAt || right.requestedAt || right.createdAt || right.startedAt || '1970-01-01T00:00:00.000Z',
    );
    return rightTime - leftTime;
  });
}

function isTaskExecutable(task: TaskRecord): boolean {
  return task.status === 'created' || task.status === 'routed';
}

export async function buildTaskListReadModel(store: TaskListReadStore): Promise<TaskListItem[]> {
  const tasks = await store.getTasks();
  const orderedTasks = [...tasks].sort((left, right) => {
    const rightTime = new Date(right.createdAt).getTime();
    const leftTime = new Date(left.createdAt).getTime();
    return rightTime - leftTime;
  });

  return Promise.all(
    orderedTasks.map(async (task) => {
      const approvals = store.getApprovalsByTaskId ? await store.getApprovalsByTaskId(task.id) : [];
      const executions = store.getExecutionsByTaskId ? await store.getExecutionsByTaskId(task.id) : [];

      return {
        ...task,
        latestApproval: sortByNewestTimestamp(approvals)[0] ?? null,
        latestExecution: sortByNewestTimestamp(executions)[0] ?? null,
        canExecute: isTaskExecutable(task),
      };
    }),
  );
}

export async function buildTaskWorkspaceSummary(tasksOrStore: TaskListReadStore | TaskListItem[]): Promise<TaskWorkspaceSummary> {
  const tasks = Array.isArray(tasksOrStore) ? tasksOrStore : await buildTaskListReadModel(tasksOrStore);
  const statusCounts: Record<TaskStatus, number> = {
    created: 0,
    routed: 0,
    queued: 0,
    running: 0,
    waiting_approval: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };

  let approvalRequiredTasks = 0;
  let readyForExecutionTasks = 0;
  let waitingApprovalTasks = 0;
  let activeTasks = 0;
  let latestCreatedAt: string | null = null;
  let latestUpdatedAt: string | null = null;

  for (const task of tasks) {
    statusCounts[task.status] += 1;

    if (task.approvalRequired) {
      approvalRequiredTasks += 1;
    }

    if ((task.status === 'created' || task.status === 'routed') && !task.approvalRequired) {
      readyForExecutionTasks += 1;
    }

    if (task.status === 'waiting_approval') {
      waitingApprovalTasks += 1;
    }

    if (task.status === 'created' || task.status === 'routed' || task.status === 'running' || task.status === 'waiting_approval') {
      activeTasks += 1;
    }

    if (!latestCreatedAt || Date.parse(task.createdAt) > Date.parse(latestCreatedAt)) {
      latestCreatedAt = task.createdAt;
    }

    if (!latestUpdatedAt || Date.parse(task.updatedAt) > Date.parse(latestUpdatedAt)) {
      latestUpdatedAt = task.updatedAt;
    }
  }

  return {
    totalTasks: tasks.length,
    statusCounts,
    approvalRequiredTasks,
    readyForExecutionTasks,
    waitingApprovalTasks,
    activeTasks,
    latestCreatedAt,
    latestUpdatedAt,
  };
}

function summarizeApprovals(approvals: ApprovalRecord[]) {
  const approvalCounts: Record<ApprovalStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };
  let latestApprovalAt: string | null = null;

  for (const approval of approvals) {
    approvalCounts[approval.status] += 1;

    const activityAt = approval.resolvedAt || approval.requestedAt;
    if (!latestApprovalAt || Date.parse(activityAt) > Date.parse(latestApprovalAt)) {
      latestApprovalAt = activityAt;
    }
  }

  return { approvalCounts, latestApprovalAt };
}

function summarizeExecutions(executions: ExecutionRecord[]) {
  let latestExecutionStatus: ExecutionRecord['status'] | null = null;
  let latestExecutionAt: string | null = null;

  for (const execution of executions) {
    const activityAt = execution.completedAt || execution.startedAt || null;
    if (activityAt && (!latestExecutionAt || Date.parse(activityAt) > Date.parse(latestExecutionAt))) {
      latestExecutionAt = activityAt;
      latestExecutionStatus = execution.status;
    }
  }

  return { latestExecutionStatus, latestExecutionAt };
}

export async function buildTaskDetailReadModel(
  taskId: string,
  store: TaskDetailReadStore
): Promise<TaskDetailReadModel | null> {
  const task = await store.getTaskById(taskId);
  if (!task) {
    return null;
  }

  const assignments = store.getTaskAssignmentsByTaskId ? await store.getTaskAssignmentsByTaskId(task.id) : [];
  const workflowPlan = store.getWorkflowPlanByTaskId ? await store.getWorkflowPlanByTaskId(task.id) : null;
  const approvals = await store.getApprovalsByTaskId(task.id);
  const executions = await store.getExecutionsByTaskId(task.id);
  const { approvalCounts, latestApprovalAt } = summarizeApprovals(approvals);
  const { latestExecutionStatus, latestExecutionAt } = summarizeExecutions(executions);

  return {
    task,
    approvals,
    executions,
    assignments: workflowPlan
      ? assignments.filter((assignment) => !assignment.workflowPlanId || assignment.workflowPlanId === workflowPlan.id)
      : assignments,
    workflowPlan,
    summary: {
      approvalCounts,
      executionCount: executions.length,
      latestExecutionStatus,
      latestExecutionAt,
      latestApprovalAt,
      approvalRequired: task.approvalRequired,
      taskStatus: task.status,
    },
  };
}
