import type { Store } from '../store';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';

export interface TaskDetailReadModel {
  task: TaskRecord;
  approvals: ApprovalRecord[];
  executions: ExecutionRecord[];
}

export function buildTaskListReadModel(store: Pick<Store, 'getTasks'>): TaskRecord[] {
  return [...store.getTasks()].sort((left, right) => {
    const rightTime = new Date(right.createdAt).getTime();
    const leftTime = new Date(left.createdAt).getTime();
    return rightTime - leftTime;
  });
}

export function buildTaskDetailReadModel(
  taskId: string,
  store: Pick<Store, 'getTaskById' | 'getApprovalsByTaskId' | 'getExecutionsByTaskId'>
): TaskDetailReadModel | null {
  const task = store.getTaskById(taskId);
  if (!task) {
    return null;
  }

  return {
    task,
    approvals: store.getApprovalsByTaskId(task.id),
    executions: store.getExecutionsByTaskId(task.id),
  };
}
