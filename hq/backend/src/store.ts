import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { SquadState } from './types';
import { ApprovalRecord, ExecutionRecord, TaskAssignment, TaskRecord, ToolCallLog, WorkflowPlan } from './shared/task-types';
import {
  ApprovalRepository,
  createFileApprovalRepository,
  createFileExecutionRepository,
  createFileTaskAssignmentRepository,
  createFileTaskRepository,
  createFileToolCallLogRepository,
  createFileWorkflowPlanRepository,
  createInMemoryApprovalRepository,
  createInMemoryExecutionRepository,
  createInMemoryTaskAssignmentRepository,
  createInMemoryTaskRepository,
  createInMemoryToolCallLogRepository,
  createInMemoryWorkflowPlanRepository,
  ExecutionRepository,
  TaskAssignmentRepository,
  TaskRepository,
  ToolCallLogRepository,
  WorkflowPlanRepository,
} from './persistence/file-repositories';
import {
  createPostgresApprovalRepository,
  createPostgresExecutionRepository,
  createPostgresTaskRepository,
} from './persistence/postgres-repositories';

const STORE_FILE = path.join(__dirname, '../../active_squad.json');
const TEMPLATES_FILE = path.join(__dirname, '../../templates.json');
const KNOWLEDGE_FILE = path.join(__dirname, '../../company_knowledge.json');
const APPROVALS_FILE = process.env.AGENCY_APPROVALS_FILE || path.join(__dirname, '../../approvals.json');
const EXECUTIONS_FILE = process.env.AGENCY_EXECUTIONS_FILE || path.join(__dirname, '../../executions.json');
const ASSIGNMENTS_FILE = process.env.AGENCY_TASK_ASSIGNMENTS_FILE || path.join(__dirname, '../../task_assignments.json');
const WORKFLOW_PLANS_FILE = process.env.AGENCY_WORKFLOW_PLANS_FILE || path.join(__dirname, '../../workflow_plans.json');
const TOOL_CALL_LOGS_FILE = process.env.AGENCY_TOOL_CALL_LOGS_FILE || path.join(__dirname, '../../tool_call_logs.json');

function getTasksFilePath() {
  return process.env.AGENCY_TASKS_FILE || path.join(__dirname, '../../tasks.json');
}

function getApprovalsFilePath() {
  return process.env.AGENCY_APPROVALS_FILE || APPROVALS_FILE;
}

function getExecutionsFilePath() {
  return process.env.AGENCY_EXECUTIONS_FILE || EXECUTIONS_FILE;
}

function getTaskAssignmentsFilePath() {
  return process.env.AGENCY_TASK_ASSIGNMENTS_FILE || ASSIGNMENTS_FILE;
}

function getWorkflowPlansFilePath() {
  return process.env.AGENCY_WORKFLOW_PLANS_FILE || WORKFLOW_PLANS_FILE;
}

function getToolCallLogsFilePath() {
  return process.env.AGENCY_TOOL_CALL_LOGS_FILE || TOOL_CALL_LOGS_FILE;
}

export interface Template {
  name: string;
  activeAgentIds: string[];
}

export interface KnowledgeEntry {
  task: string;
  agentId: string;
  resultSummary: string;
  timestamp?: number;
}

interface StorePersistenceDependencies {
  taskRepository?: TaskRepository;
  approvalRepository?: ApprovalRepository;
  executionRepository?: ExecutionRepository;
  taskAssignmentRepository?: TaskAssignmentRepository;
  workflowPlanRepository?: WorkflowPlanRepository;
  toolCallLogRepository?: ToolCallLogRepository;
}

function getPersistenceMode(): 'file' | 'memory' | 'postgres' {
  const raw = (process.env.AGENCY_PERSISTENCE_MODE || 'file').toLowerCase();
  if (raw === 'postgres') {
    return 'postgres';
  }
  return raw === 'memory' ? 'memory' : 'file';
}

function getPostgresConnectionString(): string {
  const value = process.env.AGENCY_POSTGRES_URL || process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      'Postgres persistence requires AGENCY_POSTGRES_URL or DATABASE_URL when AGENCY_PERSISTENCE_MODE=postgres'
    );
  }
  return value;
}

export class Store extends EventEmitter {
  private state: SquadState = { activeAgentIds: [] };
  private taskRepository: TaskRepository;
  private approvalRepository: ApprovalRepository;
  private executionRepository: ExecutionRepository;
  private taskAssignmentRepository: TaskAssignmentRepository;
  private workflowPlanRepository: WorkflowPlanRepository;
  private toolCallLogRepository: ToolCallLogRepository;

  constructor(dependencies: StorePersistenceDependencies = {}) {
    super();
    const mode = getPersistenceMode();
    const postgresOptions =
      mode === 'postgres'
        ? {
            connectionString: getPostgresConnectionString(),
            schema: process.env.AGENCY_POSTGRES_SCHEMA || 'public',
            taskTable: process.env.AGENCY_POSTGRES_TASKS_TABLE,
            approvalTable: process.env.AGENCY_POSTGRES_APPROVALS_TABLE,
            executionTable: process.env.AGENCY_POSTGRES_EXECUTIONS_TABLE,
          }
        : null;
    this.taskRepository =
      dependencies.taskRepository ??
      (mode === 'memory'
        ? createInMemoryTaskRepository()
        : mode === 'postgres'
          ? createPostgresTaskRepository(postgresOptions!)
          : createFileTaskRepository(getTasksFilePath()));
    this.approvalRepository =
      dependencies.approvalRepository ??
      (mode === 'memory'
        ? createInMemoryApprovalRepository()
        : mode === 'postgres'
          ? createPostgresApprovalRepository(postgresOptions!)
          : createFileApprovalRepository(getApprovalsFilePath()));
    this.executionRepository =
      dependencies.executionRepository ??
      (mode === 'memory'
        ? createInMemoryExecutionRepository()
        : mode === 'postgres'
          ? createPostgresExecutionRepository(postgresOptions!)
          : createFileExecutionRepository(getExecutionsFilePath()));
    this.taskAssignmentRepository =
      dependencies.taskAssignmentRepository ??
      (mode === 'memory'
        ? createInMemoryTaskAssignmentRepository()
        : createFileTaskAssignmentRepository(getTaskAssignmentsFilePath()));
    this.workflowPlanRepository =
      dependencies.workflowPlanRepository ??
      (mode === 'memory'
        ? createInMemoryWorkflowPlanRepository()
        : createFileWorkflowPlanRepository(getWorkflowPlansFilePath()));
    this.toolCallLogRepository =
      dependencies.toolCallLogRepository ??
      (mode === 'memory'
        ? createInMemoryToolCallLogRepository()
        : createFileToolCallLogRepository(getToolCallLogsFilePath()));
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        this.state = JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load active squad:', err);
    }
  }

  public save(activeAgentIds: string[]) {
    this.state = { activeAgentIds };
    fs.writeFileSync(STORE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    this.emit('changed', this.state);
  }

  public getActiveIds(): string[] {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.activeAgentIds || [];
      }
    } catch (err) {
      // fallback
    }
    return this.state.activeAgentIds;
  }

  // --- Templates Logic ---

  public getTemplates(): Template[] {
    try {
      if (fs.existsSync(TEMPLATES_FILE)) {
        return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
      }
    } catch (err) {}
    return [];
  }

  public saveTemplate(name: string, activeAgentIds: string[]) {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.name === name);
    if (index >= 0) {
      templates[index].activeAgentIds = activeAgentIds;
    } else {
      templates.push({ name, activeAgentIds });
    }
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
  }

  public deleteTemplate(name: string) {
    const templates = this.getTemplates().filter(t => t.name !== name);
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
  }

  // --- Knowledge Base Logic ---

  public getKnowledge(): KnowledgeEntry[] {
    try {
      if (fs.existsSync(KNOWLEDGE_FILE)) {
        return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load knowledge:', err);
    }
    return [];
  }

  public saveKnowledge(entry: KnowledgeEntry) {
    const knowledge = this.getKnowledge();
    knowledge.push({ ...entry, timestamp: Date.now() });

    // 保留最近 100 条记录，防止无限增长
    const MAX_KNOWLEDGE_ENTRIES = 100;
    if (knowledge.length > MAX_KNOWLEDGE_ENTRIES) {
      knowledge.splice(0, knowledge.length - MAX_KNOWLEDGE_ENTRIES);
    }

    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2), 'utf-8');
  }

  /**
   * 特征提取：支持中文字符和英文单词
   */
  private getFeatures(text: string): Map<string, number> {
    const features = new Map<string, number>();
    const words = text.toLowerCase().split(/[\s,，.。!！?？\-_/]+/).filter(t => t.length > 0);
    words.forEach(w => features.set(w, (features.get(w) || 0) + 1));

    // 中文按字符提取
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (/[\u4e00-\u9fa5]/.test(char)) {
        features.set(char, (features.get(char) || 0) + 1);
      }
    }
    return features;
  }

  /**
   * 计算知识条目与查询的相关性得分
   * 使用与专家匹配相同的语义匹配算法
   */
  private calculateKnowledgeScore(entry: KnowledgeEntry, query: string): number {
    const queryFeatures = this.getFeatures(query);
    const taskFeatures = this.getFeatures(entry.task);
    const resultFeatures = this.getFeatures(entry.resultSummary);
    const agentFeatures = this.getFeatures(entry.agentId);

    let score = 0;
    queryFeatures.forEach((count, feature) => {
      // 任务描述权重最高
      if (taskFeatures.has(feature)) score += count * taskFeatures.get(feature)! * 5;
      // 结果摘要次之
      if (resultFeatures.has(feature)) score += count * resultFeatures.get(feature)! * 3;
      // 专家 ID 也有参考价值
      if (agentFeatures.has(feature)) score += count * agentFeatures.get(feature)! * 2;
    });

    return score;
  }

  /**
   * 语义搜索知识库
   * 返回最相关的 3 条记录
   */
  public searchKnowledge(query: string, limit: number = 3): KnowledgeEntry[] {
    const knowledge = this.getKnowledge();
    if (!query) return [];

    // 计算每条记录的相关性得分
    const scored = knowledge
      .map(entry => ({
        entry,
        score: this.calculateKnowledgeScore(entry, query)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // 返回得分最高的 N 条
    return scored.slice(0, limit).map(item => item.entry);
  }

  // --- Task Logic ---

  public async getTasks(): Promise<TaskRecord[]> {
    try {
      return await this.taskRepository.list();
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }

    return [];
  }

  public async saveTask(task: TaskRecord): Promise<void> {
    await this.taskRepository.save(task);
  }

  public async getTaskById(taskId: string): Promise<TaskRecord | null> {
    return await this.taskRepository.getById(taskId);
  }

  public async updateTask(taskId: string, updater: (task: TaskRecord) => TaskRecord): Promise<TaskRecord | null> {
    return await this.taskRepository.update(taskId, updater);
  }

  // --- Approval Logic ---

  public async getApprovals(): Promise<ApprovalRecord[]> {
    try {
      return await this.approvalRepository.list();
    } catch (err) {
      console.error('Failed to load approvals:', err);
    }

    return [];
  }

  public async saveApproval(approval: ApprovalRecord): Promise<void> {
    await this.approvalRepository.save(approval);
  }

  public async updateApprovalStatus(
    approvalId: string,
    status: ApprovalRecord['status']
  ): Promise<ApprovalRecord | null> {
    return await this.approvalRepository.updateStatus(approvalId, status);
  }

  public async getApprovalsByTaskId(taskId: string): Promise<ApprovalRecord[]> {
    return await this.approvalRepository.listByTaskId(taskId);
  }

  // --- Execution Logic ---

  public async getExecutions(): Promise<ExecutionRecord[]> {
    try {
      return await this.executionRepository.list();
    } catch (err) {
      console.error('Failed to load executions:', err);
    }

    return [];
  }

  public async saveExecution(execution: ExecutionRecord): Promise<void> {
    await this.executionRepository.save(execution);
  }

  public async updateExecution(
    executionId: string,
    updater: (execution: ExecutionRecord) => ExecutionRecord
  ): Promise<ExecutionRecord | null> {
    return await this.executionRepository.update(executionId, updater);
  }

  public async getExecutionById(executionId: string): Promise<ExecutionRecord | null> {
    return await this.executionRepository.getById(executionId);
  }

  public async getExecutionsByTaskId(taskId: string): Promise<ExecutionRecord[]> {
    return await this.executionRepository.listByTaskId(taskId);
  }

  // --- Assignment Logic ---

  public async getTaskAssignments(): Promise<TaskAssignment[]> {
    return await this.taskAssignmentRepository.list();
  }

  public async saveTaskAssignment(taskAssignment: TaskAssignment): Promise<void> {
    await this.taskAssignmentRepository.save(taskAssignment);
  }

  public async getTaskAssignmentById(assignmentId: string): Promise<TaskAssignment | null> {
    return await this.taskAssignmentRepository.getById(assignmentId);
  }

  public async getTaskAssignmentsByTaskId(taskId: string): Promise<TaskAssignment[]> {
    return await this.taskAssignmentRepository.listByTaskId(taskId);
  }

  public async updateTaskAssignment(
    assignmentId: string,
    updater: (assignment: TaskAssignment) => TaskAssignment
  ): Promise<TaskAssignment | null> {
    return await this.taskAssignmentRepository.update(assignmentId, updater);
  }

  // --- Workflow Plan Logic ---

  public async getWorkflowPlans(): Promise<WorkflowPlan[]> {
    return await this.workflowPlanRepository.list();
  }

  public async saveWorkflowPlan(workflowPlan: WorkflowPlan): Promise<void> {
    await this.workflowPlanRepository.save(workflowPlan);
  }

  public async getWorkflowPlanByTaskId(taskId: string): Promise<WorkflowPlan | null> {
    return await this.workflowPlanRepository.getByTaskId(taskId);
  }

  public async updateWorkflowPlan(
    taskId: string,
    updater: (plan: WorkflowPlan) => WorkflowPlan
  ): Promise<WorkflowPlan | null> {
    return await this.workflowPlanRepository.update(taskId, updater);
  }

  // --- Tool Call Log Logic ---

  public async getToolCallLogs(): Promise<ToolCallLog[]> {
    return await this.toolCallLogRepository.list();
  }

  public async saveToolCallLog(toolCallLog: ToolCallLog): Promise<void> {
    await this.toolCallLogRepository.save(toolCallLog);
  }

  public async getToolCallLogById(toolCallLogId: string): Promise<ToolCallLog | null> {
    return await this.toolCallLogRepository.getById(toolCallLogId);
  }

  public async getToolCallLogsByTaskId(taskId: string): Promise<ToolCallLog[]> {
    return await this.toolCallLogRepository.listByTaskId(taskId);
  }

  public async getToolCallLogsByExecutionId(executionId: string): Promise<ToolCallLog[]> {
    const toolCallLogs = await this.toolCallLogRepository.listByExecutionId(executionId);
    if (toolCallLogs.length > 0) {
      return toolCallLogs;
    }

    const execution = await this.executionRepository.getById(executionId);
    const executionWithToolCalls = execution as ExecutionRecord & { toolCalls?: ToolCallLog[] } | null;
    return executionWithToolCalls?.toolCalls ?? [];
  }

  public async updateToolCallLog(
    toolCallLogId: string,
    updater: (toolCallLog: ToolCallLog) => ToolCallLog
  ): Promise<ToolCallLog | null> {
    return await this.toolCallLogRepository.update(toolCallLogId, updater);
  }
}
