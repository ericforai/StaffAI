import fs from 'node:fs';
import type {
  ApprovalRecord,
  CostLogEntry,
  ExecutionTraceEvent,
  ExecutionRecord,
  TaskAssignment,
  TaskRecord,
  ToolCallLog,
  WorkflowPlan,
} from '../shared/task-types';

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

export interface TaskAssignmentRepository {
  list(): Promise<TaskAssignment[]>;
  getById(assignmentId: string): Promise<TaskAssignment | null>;
  listByTaskId(taskId: string): Promise<TaskAssignment[]>;
  save(assignment: TaskAssignment): Promise<void>;
  update(
    assignmentId: string,
    updater: (assignment: TaskAssignment) => TaskAssignment
  ): Promise<TaskAssignment | null>;
}

export interface WorkflowPlanRepository {
  list(): Promise<WorkflowPlan[]>;
  getByTaskId(taskId: string): Promise<WorkflowPlan | null>;
  save(plan: WorkflowPlan): Promise<void>;
  update(taskId: string, updater: (plan: WorkflowPlan) => WorkflowPlan): Promise<WorkflowPlan | null>;
}

export interface ToolCallLogRepository {
  list(): Promise<ToolCallLog[]>;
  getById(toolCallLogId: string): Promise<ToolCallLog | null>;
  listByTaskId(taskId: string): Promise<ToolCallLog[]>;
  listByExecutionId(executionId: string): Promise<ToolCallLog[]>;
  save(toolCallLog: ToolCallLog): Promise<void>;
  update(toolCallLogId: string, updater: (toolCallLog: ToolCallLog) => ToolCallLog): Promise<ToolCallLog | null>;
}

export interface ExecutionTraceRepository {
  list(): Promise<ExecutionTraceEvent[]>;
  listByTaskId(taskId: string): Promise<ExecutionTraceEvent[]>;
  listByExecutionId(executionId: string): Promise<ExecutionTraceEvent[]>;
  append(event: ExecutionTraceEvent): Promise<void>;
}

export interface CostLogRepository {
  list(): Promise<CostLogEntry[]>;
  listByTaskId(taskId: string): Promise<CostLogEntry[]>;
  listByExecutionId(executionId: string): Promise<CostLogEntry[]>;
  save(entry: CostLogEntry): Promise<void>;
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

export function createFileTaskAssignmentRepository(filePath: string): TaskAssignmentRepository {
  return {
    async list() {
      return readJsonFile<TaskAssignment[]>(filePath, []);
    },
    async getById(assignmentId) {
      return (await this.list()).find((assignment) => assignment.id === assignmentId) || null;
    },
    async listByTaskId(taskId) {
      return (await this.list()).filter((assignment) => assignment.taskId === taskId);
    },
    async save(assignment) {
      const assignments = await this.list();
      assignments.push(assignment);
      writeJsonFile(filePath, assignments);
    },
    async update(assignmentId, updater) {
      const assignments = await this.list();
      const index = assignments.findIndex((assignment) => assignment.id === assignmentId);
      if (index < 0) {
        return null;
      }

      const updated = updater(assignments[index]);
      assignments[index] = updated;
      writeJsonFile(filePath, assignments);
      return updated;
    },
  };
}

export function createFileWorkflowPlanRepository(filePath: string): WorkflowPlanRepository {
  return {
    async list() {
      return readJsonFile<WorkflowPlan[]>(filePath, []);
    },
    async getByTaskId(taskId) {
      return (await this.list()).find((plan) => plan.taskId === taskId) || null;
    },
    async save(plan) {
      const plans = await this.list();
      plans.push(plan);
      writeJsonFile(filePath, plans);
    },
    async update(taskId, updater) {
      const plans = await this.list();
      const index = plans.findIndex((plan) => plan.taskId === taskId);
      if (index < 0) {
        return null;
      }

      const updated = updater(plans[index]);
      plans[index] = updated;
      writeJsonFile(filePath, plans);
      return updated;
    },
  };
}

export function createInMemoryTaskAssignmentRepository(seed: TaskAssignment[] = []): TaskAssignmentRepository {
  const assignments = [...seed];
  return {
    async list() {
      return [...assignments];
    },
    async getById(assignmentId) {
      return assignments.find((assignment) => assignment.id === assignmentId) || null;
    },
    async listByTaskId(taskId) {
      return assignments.filter((assignment) => assignment.taskId === taskId);
    },
    async save(assignment) {
      assignments.push(assignment);
    },
    async update(assignmentId, updater) {
      const index = assignments.findIndex((assignment) => assignment.id === assignmentId);
      if (index < 0) {
        return null;
      }
      assignments[index] = updater(assignments[index]);
      return assignments[index];
    },
  };
}

export function createInMemoryWorkflowPlanRepository(seed: WorkflowPlan[] = []): WorkflowPlanRepository {
  const plans = [...seed];
  return {
    async list() {
      return [...plans];
    },
    async getByTaskId(taskId) {
      return plans.find((plan) => plan.taskId === taskId) || null;
    },
    async save(plan) {
      plans.push(plan);
    },
    async update(taskId, updater) {
      const index = plans.findIndex((plan) => plan.taskId === taskId);
      if (index < 0) {
        return null;
      }
      plans[index] = updater(plans[index]);
      return plans[index];
    },
  };
}

export function createFileToolCallLogRepository(filePath: string): ToolCallLogRepository {
  return {
    async list() {
      return readJsonFile<ToolCallLog[]>(filePath, []);
    },
    async getById(toolCallLogId) {
      return (await this.list()).find((toolCallLog) => toolCallLog.id === toolCallLogId) || null;
    },
    async listByTaskId(taskId) {
      return (await this.list()).filter((toolCallLog) => toolCallLog.taskId === taskId);
    },
    async listByExecutionId(executionId) {
      return (await this.list()).filter((toolCallLog) => toolCallLog.executionId === executionId);
    },
    async save(toolCallLog) {
      const toolCallLogs = await this.list();
      toolCallLogs.push(toolCallLog);
      writeJsonFile(filePath, toolCallLogs);
    },
    async update(toolCallLogId, updater) {
      const toolCallLogs = await this.list();
      const index = toolCallLogs.findIndex((toolCallLog) => toolCallLog.id === toolCallLogId);
      if (index < 0) {
        return null;
      }

      const updated = updater(toolCallLogs[index]);
      toolCallLogs[index] = updated;
      writeJsonFile(filePath, toolCallLogs);
      return updated;
    },
  };
}

export function createFileExecutionTraceRepository(filePath: string): ExecutionTraceRepository {
  return {
    async list() {
      return readJsonFile<ExecutionTraceEvent[]>(filePath, []);
    },
    async listByTaskId(taskId) {
      return (await this.list()).filter((event) => event.taskId === taskId);
    },
    async listByExecutionId(executionId) {
      return (await this.list()).filter((event) => event.executionId === executionId);
    },
    async append(event) {
      const events = await this.list();
      events.push(event);
      writeJsonFile(filePath, events);
    },
  };
}

export function createInMemoryExecutionTraceRepository(seed: ExecutionTraceEvent[] = []): ExecutionTraceRepository {
  const events = [...seed];
  return {
    async list() {
      return [...events];
    },
    async listByTaskId(taskId) {
      return events.filter((event) => event.taskId === taskId);
    },
    async listByExecutionId(executionId) {
      return events.filter((event) => event.executionId === executionId);
    },
    async append(event) {
      events.push(event);
    },
  };
}

export function createFileCostLogRepository(filePath: string): CostLogRepository {
  return {
    async list() {
      return readJsonFile<CostLogEntry[]>(filePath, []);
    },
    async listByTaskId(taskId) {
      return (await this.list()).filter((entry) => entry.taskId === taskId);
    },
    async listByExecutionId(executionId) {
      return (await this.list()).filter((entry) => entry.executionId === executionId);
    },
    async save(entry) {
      const entries = await this.list();
      entries.push(entry);
      writeJsonFile(filePath, entries);
    },
  };
}

export function createInMemoryCostLogRepository(seed: CostLogEntry[] = []): CostLogRepository {
  const entries = [...seed];
  return {
    async list() {
      return [...entries];
    },
    async listByTaskId(taskId) {
      return entries.filter((entry) => entry.taskId === taskId);
    },
    async listByExecutionId(executionId) {
      return entries.filter((entry) => entry.executionId === executionId);
    },
    async save(entry) {
      entries.push(entry);
    },
  };
}

export function createInMemoryToolCallLogRepository(seed: ToolCallLog[] = []): ToolCallLogRepository {
  const toolCallLogs = [...seed];
  return {
    async list() {
      return [...toolCallLogs];
    },
    async getById(toolCallLogId) {
      return toolCallLogs.find((toolCallLog) => toolCallLog.id === toolCallLogId) || null;
    },
    async listByTaskId(taskId) {
      return toolCallLogs.filter((toolCallLog) => toolCallLog.taskId === taskId);
    },
    async listByExecutionId(executionId) {
      return toolCallLogs.filter((toolCallLog) => toolCallLog.executionId === executionId);
    },
    async save(toolCallLog) {
      toolCallLogs.push(toolCallLog);
    },
    async update(toolCallLogId, updater) {
      const index = toolCallLogs.findIndex((toolCallLog) => toolCallLog.id === toolCallLogId);
      if (index < 0) {
        return null;
      }
      toolCallLogs[index] = updater(toolCallLogs[index]);
      return toolCallLogs[index];
    },
  };
}
