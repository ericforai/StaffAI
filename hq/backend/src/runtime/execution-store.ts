import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export type ExecutionStatus = 'running' | 'paused' | 'cancelled' | 'completed' | 'failed';

export interface ExecutionState {
  executionId: string;
  status: ExecutionStatus;
  taskId: string;
  workflowPlanId?: string;
  assignmentId?: string;
  executor: 'claude' | 'codex' | 'openai';
  startedAt: string;
  pausedAt?: string;
  resumedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  checkpointData?: Record<string, unknown>;
}

export class ExecutionStateStore {
  private readonly stateDir: string;

  constructor(stateDir: string) {
    this.stateDir = stateDir;
  }

  async save(state: ExecutionState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    const filePath = this.getExecutionPath(state.executionId);
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  async load(executionId: string): Promise<ExecutionState | null> {
    const filePath = this.getExecutionPath(executionId);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as ExecutionState;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(executionId: string): Promise<void> {
    const filePath = this.getExecutionPath(executionId);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async listAll(): Promise<ExecutionState[]> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
      const entries = await fs.readdir(this.stateDir, { withFileTypes: true });
      const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

      const states: ExecutionState[] = [];
      for (const file of jsonFiles) {
        const filePath = join(this.stateDir, file.name);
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          const state = JSON.parse(raw) as ExecutionState;
          states.push(state);
        } catch {
          continue;
        }
      }

      return states;
    } catch {
      return [];
    }
  }

  async findByTaskId(taskId: string): Promise<ExecutionState[]> {
    const allStates = await this.listAll();
    return allStates.filter((state) => state.taskId === taskId);
  }

  async exists(executionId: string): Promise<boolean> {
    const filePath = this.getExecutionPath(executionId);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getExecutionPath(executionId: string): string {
    const sanitizedId = executionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.stateDir, `${sanitizedId}.json`);
  }
}
