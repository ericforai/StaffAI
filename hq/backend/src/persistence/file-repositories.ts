import fs from 'node:fs';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJsonFile(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export interface TaskRepository {
  list(): Promise<TaskRecord[]>;
  getById(taskId: string): Promise<TaskRecord | null>;
  save(task: TaskRecord): Promise<void>;
  update(taskId: string, updater: (task: TaskRecord) => TaskRecord): Promise<TaskRecord | null>;
}

export interface ApprovalRepository {
  list(): Promise<ApprovalRecord[]>;
  listByTaskId(taskId: string): Promise<ApprovalRecord[]>;
  save(approval: ApprovalRecord): Promise<void>;
  updateStatus(approvalId: string, status: ApprovalRecord['status']): Promise<ApprovalRecord | null>;
}

export interface ExecutionRepository {
  list(): Promise<ExecutionRecord[]>;
  getById(executionId: string): Promise<ExecutionRecord | null>;
  listByTaskId(taskId: string): Promise<ExecutionRecord[]>;
  save(execution: ExecutionRecord): Promise<void>;
  update(
    executionId: string,
    updater: (execution: ExecutionRecord) => ExecutionRecord
  ): Promise<ExecutionRecord | null>;
}

export function createFileTaskRepository(filePath: string): TaskRepository {
  return {
    async list() {
      return readJsonFile<TaskRecord[]>(filePath, []);
    },
    async getById(taskId) {
      return (await this.list()).find((task) => task.id === taskId) || null;
    },
    async save(task) {
      const tasks = await this.list();
      tasks.push(task);
      writeJsonFile(filePath, tasks);
    },
    async update(taskId, updater) {
      const tasks = await this.list();
      const index = tasks.findIndex((task) => task.id === taskId);
      if (index < 0) {
        return null;
      }

      const updated = updater(tasks[index]);
      tasks[index] = updated;
      writeJsonFile(filePath, tasks);
      return updated;
    },
  };
}

export function createFileApprovalRepository(filePath: string): ApprovalRepository {
  return {
    async list() {
      return readJsonFile<ApprovalRecord[]>(filePath, []);
    },
    async listByTaskId(taskId) {
      return (await this.list()).filter((approval) => approval.taskId === taskId);
    },
    async save(approval) {
      const approvals = await this.list();
      approvals.push(approval);
      writeJsonFile(filePath, approvals);
    },
    async updateStatus(approvalId, status) {
      const approvals = await this.list();
      const target = approvals.find((approval) => approval.id === approvalId);
      if (!target) {
        return null;
      }

      target.status = status;
      target.resolvedAt = new Date().toISOString();
      writeJsonFile(filePath, approvals);
      return target;
    },
  };
}

export function createFileExecutionRepository(filePath: string): ExecutionRepository {
  return {
    async list() {
      return readJsonFile<ExecutionRecord[]>(filePath, []);
    },
    async getById(executionId) {
      return (await this.list()).find((execution) => execution.id === executionId) || null;
    },
    async listByTaskId(taskId) {
      return (await this.list()).filter((execution) => execution.taskId === taskId);
    },
    async save(execution) {
      const executions = await this.list();
      executions.push(execution);
      writeJsonFile(filePath, executions);
    },
    async update(executionId, updater) {
      const executions = await this.list();
      const index = executions.findIndex((execution) => execution.id === executionId);
      if (index < 0) {
        return null;
      }

      const updated = updater(executions[index]);
      executions[index] = updated;
      writeJsonFile(filePath, executions);
      return updated;
    },
  };
}

export function createInMemoryTaskRepository(seed: TaskRecord[] = []): TaskRepository {
  const tasks = [...seed];
  return {
    async list() {
      return [...tasks];
    },
    async getById(taskId) {
      return tasks.find((task) => task.id === taskId) || null;
    },
    async save(task) {
      tasks.push(task);
    },
    async update(taskId, updater) {
      const index = tasks.findIndex((task) => task.id === taskId);
      if (index < 0) {
        return null;
      }
      tasks[index] = updater(tasks[index]);
      return tasks[index];
    },
  };
}

export function createInMemoryApprovalRepository(seed: ApprovalRecord[] = []): ApprovalRepository {
  const approvals = [...seed];
  return {
    async list() {
      return [...approvals];
    },
    async listByTaskId(taskId) {
      return approvals.filter((approval) => approval.taskId === taskId);
    },
    async save(approval) {
      approvals.push(approval);
    },
    async updateStatus(approvalId, status) {
      const target = approvals.find((approval) => approval.id === approvalId);
      if (!target) {
        return null;
      }
      target.status = status;
      target.resolvedAt = new Date().toISOString();
      return target;
    },
  };
}

export function createInMemoryExecutionRepository(seed: ExecutionRecord[] = []): ExecutionRepository {
  const executions = [...seed];
  return {
    async list() {
      return [...executions];
    },
    async getById(executionId) {
      return executions.find((execution) => execution.id === executionId) || null;
    },
    async listByTaskId(taskId) {
      return executions.filter((execution) => execution.taskId === taskId);
    },
    async save(execution) {
      executions.push(execution);
    },
    async update(executionId, updater) {
      const index = executions.findIndex((execution) => execution.id === executionId);
      if (index < 0) {
        return null;
      }
      executions[index] = updater(executions[index]);
      return executions[index];
    },
  };
}
