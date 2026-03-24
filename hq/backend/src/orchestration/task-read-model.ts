import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';

type Awaitable<T> = T | Promise<T>;

export interface TaskListReadStore {
  getTasks(): Awaitable<TaskRecord[]>;
}

export interface TaskDetailReadStore {
  getTaskById(taskId: string): Awaitable<TaskRecord | null>;
  getApprovalsByTaskId(taskId: string): Awaitable<ApprovalRecord[]>;
  getExecutionsByTaskId(taskId: string): Awaitable<ExecutionRecord[]>;
}

export interface TaskDetailReadModel {
  task: TaskRecord;
  approvals: ApprovalRecord[];
  executions: ExecutionRecord[];
}

export async function buildTaskListReadModel(store: TaskListReadStore): Promise<TaskRecord[]> {
  const tasks = await store.getTasks();
  return [...tasks].sort((left, right) => {
    const rightTime = new Date(right.createdAt).getTime();
    const leftTime = new Date(left.createdAt).getTime();
    return rightTime - leftTime;
  });
}

export async function buildTaskDetailReadModel(
  taskId: string,
  store: TaskDetailReadStore
): Promise<TaskDetailReadModel | null> {
  const task = await store.getTaskById(taskId);
  if (!task) {
    return null;
  }

  return {
    task,
    approvals: await store.getApprovalsByTaskId(task.id),
    executions: await store.getExecutionsByTaskId(task.id),
  };
}
