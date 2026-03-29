import type { TaskRepository } from '../persistence/file-repositories';
import type { AuditLogger } from '../governance/audit-logger';
import type { TaskRecord, TaskStatus } from '../shared/task-types';

export const TASK_STATE_TRANSITIONS: Record<TaskStatus, string[]> = {
  created: ['route', 'request_approval', 'start_execution', 'cancel'],
  routed: ['request_approval', 'enqueue_task', 'start_execution', 'cancel'],
  queued: ['start_execution', 'fail_execution', 'cancel'],
  waiting_approval: ['approve', 'reject', 'cancel'],
  running: ['complete_execution', 'fail_execution', 'cancel'],
  suspended: ['resume', 'cancel'],
  completed: [],
  failed: [],
  cancelled: [],
};

const EVENT_TO_STATUS: Record<TaskStatus, Record<string, TaskStatus | undefined>> = {
  created: {
    route: 'routed',
    request_approval: 'waiting_approval',
    enqueue: 'queued',
    start_execution: 'running',
    cancel: 'cancelled',
  },
  routed: {
    request_approval: 'waiting_approval',
    enqueue_task: 'queued',
    start_execution: 'running',
    cancel: 'cancelled',
  },
  queued: {
    start_execution: 'running',
    fail_execution: 'failed',
    cancel: 'cancelled',
  },
  waiting_approval: {
    approve: 'routed',
    reject: 'failed',
    cancel: 'cancelled',
  },
  running: {
    complete_execution: 'completed',
    fail_execution: 'failed',
    cancel: 'cancelled',
  },
  suspended: {
    resume: 'running',
    cancel: 'cancelled',
  },
  completed: {},
  failed: {},
  cancelled: {},
};

export type TaskEvent =
  | 'create'
  | 'route'
  | 'request_approval'
  | 'approve'
  | 'reject'
  | 'cancel_approval'
  | 'enqueue_task'
  | 'start_execution'
  | 'complete_execution'
  | 'fail_execution'
  | 'cancel'
  | 'suspend'
  | 'resume';

export interface TaskTransitionResult {
  success: boolean;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  taskId: string;
  error?: string;
}

export class TaskStateMachine {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly auditLogger: AuditLogger | null = null
  ) {}

  async canTransition(taskId: string, toStatus: TaskStatus): Promise<boolean> {
    const task = await this.taskRepository.getById(taskId);
    if (!task) {
      return false;
    }

    const availableTransitions = await this.getAvailableTransitions(taskId);
    return availableTransitions.includes(toStatus);
  }

  async getAvailableTransitions(taskId: string): Promise<TaskStatus[]> {
    const task = await this.taskRepository.getById(taskId);
    if (!task) {
      return [];
    }

    const events = TASK_STATE_TRANSITIONS[task.status] || [];
    const statuses: TaskStatus[] = [];

    for (const event of events) {
      const statusMap = EVENT_TO_STATUS[task.status];
      if (statusMap && statusMap[event]) {
        statuses.push(statusMap[event]!);
      }
    }

    return statuses;
  }

  async transition(
    taskId: string,
    event: TaskEvent,
    actor: string,
    reason?: string
  ): Promise<TaskTransitionResult> {
    const task = await this.taskRepository.getById(taskId);
    if (!task) {
      return {
        success: false,
        previousStatus: 'created',
        newStatus: 'created',
        taskId,
        error: `Task not found: ${taskId}`,
      };
    }

    const previousStatus = task.status;
    const allowedEvents = TASK_STATE_TRANSITIONS[previousStatus] || [];

    if (!allowedEvents.includes(event)) {
      const eventToStatusMap: Record<string, TaskStatus> = {
        route: 'routed',
        request_approval: 'waiting_approval',
        approve: 'routed',
        reject: 'failed',
        enqueue_task: 'queued',
        start_execution: 'running',
        complete_execution: 'completed',
        fail_execution: 'failed',
        cancel: 'cancelled',
      };
      const targetStatus = eventToStatusMap[event] ?? 'unknown';
      return {
        success: false,
        previousStatus,
        newStatus: previousStatus,
        taskId,
        error: `Invalid state transition from ${previousStatus} to ${targetStatus}`,
      };
    }

    const statusMap = EVENT_TO_STATUS[previousStatus];
    const newStatus = statusMap?.[event];

    if (!newStatus) {
      return {
        success: false,
        previousStatus,
        newStatus: previousStatus,
        taskId,
        error: `No target status defined for event ${event} from ${previousStatus}`,
      };
    }

    const updated = await this.taskRepository.update(taskId, (task) => ({
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    }));

    if (!updated) {
      return {
        success: false,
        previousStatus,
        newStatus: previousStatus,
        taskId,
        error: 'Failed to update task status',
      };
    }

    if (this.auditLogger) {
      await this.auditLogger.log({
        entityType: 'task',
        entityId: taskId,
        action: 'status_changed',
        actor,
        previousState: { status: previousStatus },
        newState: { status: newStatus },
        reason,
      });
    }

    return {
      success: true,
      previousStatus,
      newStatus,
      taskId,
    };
  }
}

export function createTaskStateMachine(
  taskRepository: TaskRepository,
  auditLogger: AuditLogger | null = null
): TaskStateMachine {
  return new TaskStateMachine(taskRepository, auditLogger);
}
