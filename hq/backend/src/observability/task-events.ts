import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';

type TaskEventType =
  | 'task_created'
  | 'approval_requested'
  | 'approval_resolved'
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_degraded'
  | 'execution_event';

export interface TaskDashboardEvent {
  type: 'TASK_EVENT';
  taskEventType: TaskEventType;
  message: string;
  taskId?: string;
  approvalId?: string;
  executionId?: string;
  payload?: any;
}

export function createTaskEventPublisher(publish: (event: TaskDashboardEvent) => void) {
  return {
    taskCreated(task: TaskRecord) {
      publish({
        type: 'TASK_EVENT',
        taskEventType: 'task_created',
        taskId: task.id,
        message: `任务已创建：${task.title}`,
      });
    },
    approvalRequested(approval: ApprovalRecord) {
      publish({
        type: 'TASK_EVENT',
        taskEventType: 'approval_requested',
        taskId: approval.taskId,
        approvalId: approval.id,
        message: `任务进入审批队列：${approval.id}`,
      });
    },
    approvalResolved(approval: ApprovalRecord) {
      publish({
        type: 'TASK_EVENT',
        taskEventType: 'approval_resolved',
        taskId: approval.taskId,
        approvalId: approval.id,
        message: `审批已${approval.status === 'approved' ? '通过' : '拒绝'}：${approval.id}`,
      });
    },
    executionStarted(input: { taskId: string; executor: string }) {
      publish({
        type: 'TASK_EVENT',
        taskEventType: 'execution_started',
        taskId: input.taskId,
        message: '任务开始执行',
      });
    },
    executionFinished(execution: ExecutionRecord) {
      const taskEventType =
        execution.status === 'completed'
          ? 'execution_completed'
          : execution.status === 'degraded'
            ? 'execution_degraded'
            : 'execution_failed';
      const statusMessage =
        execution.status === 'completed'
          ? '执行已完成'
          : execution.status === 'degraded'
            ? '执行已降级完成'
            : '执行失败';

      publish({
        type: 'TASK_EVENT',
        taskEventType,
        taskId: execution.taskId,
        executionId: execution.id,
        message: `${statusMessage}：${execution.id}`,
      });
    },
    executionEvent(input: { taskId: string; message: string; payload?: any }) {
      publish({
        type: 'TASK_EVENT',
        taskEventType: 'execution_event',
        taskId: input.taskId,
        message: input.message,
        payload: input.payload,
      });
    },
  };
}
