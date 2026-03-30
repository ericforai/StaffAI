/**
 * StaffAI Domain Entities
 * These types represent the core business logic and data structures.
 * They should align closely with the backend domain models.
 */

export interface AgentFrontmatter {
  name: string;
  description: string;
  color?: string;
  emoji?: string;
  vibe?: string;
  tools?: string;
}

export interface Agent {
  id: string;
  department: string;
  frontmatter: AgentFrontmatter;
}

export type TaskExecutionMode = 'single' | 'serial' | 'parallel' | 'advanced_discussion';

/** Matches backend `WORKFLOW_PLAN_MODES` */
export type WorkflowPlanMode = 'single' | 'serial' | 'parallel';

export interface WorkflowPlanStep {
  id: string;
  title: string;
  description?: string;
  agentId?: string;
  assignmentRole?: string;
  assignmentId?: string;
  status?: string;
  order?: number;
}

export interface WorkflowPlan {
  id: string;
  taskId: string;
  mode: WorkflowPlanMode;
  synthesisRequired: boolean;
  steps: WorkflowPlanStep[];
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  agentId: string;
  agentName?: string;
  assignmentRole?: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  resultSummary?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  executionMode: TaskExecutionMode | string;
  approvalRequired: boolean;
  riskLevel: string;
  recommendedAgentRole: string;
  routingStatus: string;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
  latestApproval?: Approval | null;
  latestExecution?: TaskExecution | null;
  canExecute?: boolean;
  workflowPlan?: WorkflowPlan | null;
  assignments?: TaskAssignment[];
}

export interface Approval {
  id: string;
  taskId: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  resolvedAt?: string;
}

export interface TaskExecution {
  id: string;
  displayExecutionId?: string;
  taskId: string;
  status: string;
  executor?: 'claude' | 'codex' | 'openai' | 'deerflow';
  runtimeName?: string;
  degraded?: boolean;
  outputSummary?: string;
  errorMessage?: string;
  memoryContextExcerpt?: string;
  startedAt?: string;
  completedAt?: string;
  assignmentId?: string;
  assignmentRole?: string;
  workflowStepId?: string;
  workflowPlanId?: string;
  toolCalls?: ToolCall[];
  controlState?: ExecutionControlState;
}

export interface ExecutionControlState {
  executionId: string;
  status: string;
  taskId: string;
  pausedAt?: string;
  resumedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
}

export interface ToolCall {
  id: string;
  toolName: string;
  status: string;
  riskLevel?: string;
  actorRole?: string;
  inputSummary?: string;
  outputSummary?: string;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
}

export interface ExecutionTrace {
  executionId: string;
  traceEvents: TraceEvent[];
}

export interface TraceEvent {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
  payload?: any;
}
