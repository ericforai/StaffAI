import type { Store } from '../store';
import type { TaskRecord, TaskStatus } from '../shared/task-types';
import { TaskStateMachine } from './task-state-machine';
import {
  SuspendReason,
  SuspendPayload,
  HumanFeedbackPayload,
} from '../shared/hitl-types';

export interface HitlResult {
  task: TaskRecord;
  suspendPayload?: SuspendPayload;
  feedback?: HumanFeedbackPayload;
}

export class HitlService {
  private store: Store;
  private stateMachine: TaskStateMachine;

  constructor(deps: { store: Store; stateMachine: TaskStateMachine }) {
    this.store = deps.store;
    this.stateMachine = deps.stateMachine;
  }

  async suspend(
    taskId: string,
    reason: SuspendReason,
    reasonMessage: string,
    suspendedBy: string
  ): Promise<HitlResult> {
    const task = await this.store.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== 'running') {
      throw new Error(`Task is not running: status=${task.status}`);
    }

    await this.stateMachine.transition(
      taskId,
      'suspend',
      suspendedBy,
      `Suspended: ${reason}`
    );

    const updatedTask = await this.store.updateTask(taskId, (current) => ({
      ...current,
      status: 'suspended' as TaskStatus,
      updatedAt: new Date().toISOString(),
    }));

    const suspendPayload: SuspendPayload = {
      reason,
      message: reasonMessage,
      suspendedBy,
      suspendedAt: new Date().toISOString(),
    };

    return { task: updatedTask!, suspendPayload };
  }

  async resume(
    taskId: string,
    feedback: HumanFeedbackPayload,
    resumedBy: string
  ): Promise<HitlResult> {
    const task = await this.store.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== 'suspended') {
      throw new Error(`Task is not suspended: status=${task.status}`);
    }

    await this.stateMachine.transition(
      taskId,
      'resume',
      resumedBy,
      'Resumed with human feedback'
    );

    const updatedTask = await this.store.updateTask(taskId, (current) => ({
      ...current,
      status: 'running' as TaskStatus,
      updatedAt: new Date().toISOString(),
    }));

    return {
      task: updatedTask!,
      feedback,
    };
  }
}
