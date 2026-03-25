import type { ExecutionState, ExecutionStatus } from './execution-store';
import { ExecutionStateStore } from './execution-store';

export { type ExecutionState };

export interface PauseOptions {
  checkpointData?: Record<string, unknown>;
}

export class TaskController {
  private readonly store: ExecutionStateStore;

  constructor(store: ExecutionStateStore) {
    this.store = store;
  }

  async pause(executionId: string, options: PauseOptions = {}): Promise<void> {
    const state = await this.store.load(executionId);
    if (!state) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (state.status === 'paused') {
      return;
    }

    if (!this.canPause(state.status)) {
      throw new Error(`Cannot pause execution with status: ${state.status}`);
    }

    const pausedState: ExecutionState = {
      ...state,
      status: 'paused',
      pausedAt: new Date().toISOString(),
      ...(options.checkpointData && { checkpointData: options.checkpointData }),
    };

    await this.store.save(pausedState);
  }

  async resume(executionId: string): Promise<void> {
    const state = await this.store.load(executionId);
    if (!state) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (state.status === 'running') {
      return;
    }

    if (!this.canResume(state.status)) {
      throw new Error(`Cannot resume execution with status: ${state.status}`);
    }

    const resumedState: ExecutionState = {
      ...state,
      status: 'running',
      resumedAt: new Date().toISOString(),
    };

    await this.store.save(resumedState);
  }

  async cancel(executionId: string): Promise<void> {
    const state = await this.store.load(executionId);
    if (!state) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (state.status === 'cancelled' || state.status === 'failed' || state.status === 'completed') {
      return;
    }

    const cancelledState: ExecutionState = {
      ...state,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    };

    await this.store.save(cancelledState);
  }

  async getStatus(executionId: string): Promise<ExecutionState | null> {
    return this.store.load(executionId);
  }

  private canPause(status: ExecutionStatus): boolean {
    return status === 'running';
  }

  private canResume(status: ExecutionStatus): boolean {
    return status === 'paused';
  }
}
