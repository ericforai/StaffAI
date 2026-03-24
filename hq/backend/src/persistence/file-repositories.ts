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
  list(): TaskRecord[];
  getById(taskId: string): TaskRecord | null;
  save(task: TaskRecord): void;
  update(taskId: string, updater: (task: TaskRecord) => TaskRecord): TaskRecord | null;
}

export interface ApprovalRepository {
  list(): ApprovalRecord[];
  listByTaskId(taskId: string): ApprovalRecord[];
  save(approval: ApprovalRecord): void;
  updateStatus(approvalId: string, status: ApprovalRecord['status']): ApprovalRecord | null;
}

export interface ExecutionRepository {
  list(): ExecutionRecord[];
  getById(executionId: string): ExecutionRecord | null;
  listByTaskId(taskId: string): ExecutionRecord[];
  save(execution: ExecutionRecord): void;
  update(
    executionId: string,
    updater: (execution: ExecutionRecord) => ExecutionRecord
  ): ExecutionRecord | null;
}

export function createFileTaskRepository(filePath: string): TaskRepository {
  return {
    list() {
      return readJsonFile<TaskRecord[]>(filePath, []);
    },
    getById(taskId) {
      return this.list().find((task) => task.id === taskId) || null;
    },
    save(task) {
      const tasks = this.list();
      tasks.push(task);
      writeJsonFile(filePath, tasks);
    },
    update(taskId, updater) {
      const tasks = this.list();
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
    list() {
      return readJsonFile<ApprovalRecord[]>(filePath, []);
    },
    listByTaskId(taskId) {
      return this.list().filter((approval) => approval.taskId === taskId);
    },
    save(approval) {
      const approvals = this.list();
      approvals.push(approval);
      writeJsonFile(filePath, approvals);
    },
    updateStatus(approvalId, status) {
      const approvals = this.list();
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
    list() {
      return readJsonFile<ExecutionRecord[]>(filePath, []);
    },
    getById(executionId) {
      return this.list().find((execution) => execution.id === executionId) || null;
    },
    listByTaskId(taskId) {
      return this.list().filter((execution) => execution.taskId === taskId);
    },
    save(execution) {
      const executions = this.list();
      executions.push(execution);
      writeJsonFile(filePath, executions);
    },
    update(executionId, updater) {
      const executions = this.list();
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
    list() {
      return [...tasks];
    },
    getById(taskId) {
      return tasks.find((task) => task.id === taskId) || null;
    },
    save(task) {
      tasks.push(task);
    },
    update(taskId, updater) {
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
    list() {
      return [...approvals];
    },
    listByTaskId(taskId) {
      return approvals.filter((approval) => approval.taskId === taskId);
    },
    save(approval) {
      approvals.push(approval);
    },
    updateStatus(approvalId, status) {
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
    list() {
      return [...executions];
    },
    getById(executionId) {
      return executions.find((execution) => execution.id === executionId) || null;
    },
    listByTaskId(taskId) {
      return executions.filter((execution) => execution.taskId === taskId);
    },
    save(execution) {
      executions.push(execution);
    },
    update(executionId, updater) {
      const index = executions.findIndex((execution) => execution.id === executionId);
      if (index < 0) {
        return null;
      }
      executions[index] = updater(executions[index]);
      return executions[index];
    },
  };
}
