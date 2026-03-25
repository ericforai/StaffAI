import type { TaskRepository } from '../persistence/file-repositories';
import type { AuditLogger } from '../governance/audit-logger';
import type { TaskRecord, TaskStatus } from '../shared/task-types';

/**
 * State transition map defining valid state transitions
 * Maps current status to array of allowed events
 */
export const TASK_STATE_TRANSITIONS: Record<TaskStatus, string[]> = {
  created: ['route', 'request_approval', 'enqueue', 'start_execution', 'cancel'],
  routed: ['request_approval', 'enqueue', 'start_execution', 'cancel'],
  waiting_approval: ['approve', 'reject', 'cancel'],
  queued: ['start_execution', 'fail_execution', 'cancel'],
  running: ['complete_execution', 'fail_execution', 'cancel'],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * Maps events to resulting status for each starting state
 */
const EVENT_TO_STATUS: Record<TaskStatus, Record<string, TaskStatus>> = {
  created: {
    route: 'routed',
    request_approval: 'waiting_approval',
    enqueue: 'queued',
    start_execution: 'running',
    cancel: 'cancelled',
  },
  routed: {
    request_approval: 'waiting_approval',
    enqueue: 'queued',
    start_execution: 'running',
    cancel: 'cancelled',
  },
  waiting_approval: {
    approve: 'routed',
    reject: 'failed',
    cancel: 'cancelled',
  },
  queued: {
    start_execution: 'running',
    fail_execution: 'failed',
    cancel: 'cancelled',
  },
  running: {
    complete_execution: 'completed',
    fail_execution: 'failed',
    cancel: 'cancelled',
  },
  completed: {},
  failed: {},
  cancelled: {},
};

/**
 * Events that can trigger state transitions
 */
export type TaskEvent =
  | 'create'
  | 'route'
  | 'request_approval'
  | 'approve'
  | 'reject'
  | 'cancel_approval'
  | 'enqueue'
  | 'start_execution'
  | 'complete_execution'
  | 'fail_execution'
  | 'cancel';

/**
 * Result of a state transition attempt
 */
export interface TaskTransitionResult {
  success: boolean;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  taskId: string;
  error?: string;
}

/**
 * State machine for task lifecycle management
 * Validates and executes state transitions with audit logging
 */
export class TaskStateMachine {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly auditLogger: AuditLogger | null = null
  ) {}

  /**
   * Check if a transition is valid without executing it
   * @param taskId ID of the task to check
   * @param toStatus Target status to transition to
   * @returns true if transition is valid, false otherwise
   */
  async canTransition(taskId: string, toStatus: TaskStatus): Promise<boolean> {
    const task = await this.taskRepository.getById(taskId);
    if (!task) {
      return false;
    }

    const availableTransitions = await this.getAvailableTransitions(taskId);
    return availableTransitions.includes(toStatus);
  }

  /**
   * Get all possible target statuses for a task's current state
   * @param taskId ID of the task
   * @returns Array of valid target statuses
   */
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
        statuses.push(statusMap[event]);
      }
    }

    return statuses;
  }

  /**
   * Execute a state transition for a task
   * @param taskId ID of the task to transition
   * @param event Event triggering the transition
   * @param actor User or system performing the transition
   * @param reason Optional reason for the transition
   * @returns Result of the transition attempt
   */
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
      // Build a helpful error message showing what status would result from this event
      // if it were allowed (e.g., 'complete_execution' -> 'completed')
      const eventToStatusMap: Record<string, TaskStatus> = {
        route: 'routed',
        request_approval: 'waiting_approval',
        approve: 'routed',
        reject: 'failed',
        enqueue: 'queued',
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

    // Log audit event
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

/**
 * Factory function to create a TaskStateMachine instance
 * @param taskRepository Repository for task persistence
 * @param auditLogger Optional audit logger for state change tracking
 * @returns Configured TaskStateMachine instance
 */
export function createTaskStateMachine(
  taskRepository: TaskRepository,
  auditLogger: AuditLogger | null = null
): TaskStateMachine {
  return new TaskStateMachine(taskRepository, auditLogger);
}
