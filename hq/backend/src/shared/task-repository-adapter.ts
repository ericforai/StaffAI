import type { Store } from '../store';
import type { TaskRecord } from './task-types';
import type { TaskRepository } from '../persistence/file-repositories';

import { TaskStateMachine } from '../orchestration/task-state-machine';

import { HitlService } from '../orchestration/hitl-service';

export class TaskRepositoryAdapter implements TaskRepository {
  constructor(private store: Store) {}

  async list(): Promise<TaskRecord[]> {
    return this.store.getTasks();
  }

  async getById(taskId: string): Promise<TaskRecord | null> {
    return this.store.getTaskById(taskId);
  }

  async save(task: TaskRecord): Promise<void> {
    return this.store.saveTask(task);
  }

  async update(taskId: string, updater: (task: TaskRecord) => TaskRecord): Promise<TaskRecord | null> {
    return this.store.updateTask(taskId, updater);
  }
}
