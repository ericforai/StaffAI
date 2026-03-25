export const TASK_STATUSES = [
  'created',
  'routed',
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

// Risk levels for approval assessment
export const APPROVAL_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ApprovalRiskLevel = (typeof APPROVAL_RISK_LEVELS)[number];

export const EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed', 'degraded'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = [
  'architecture_analysis',
  'backend_implementation',
  'code_review',
  'documentation',
  'workflow_dispatch',
  'frontend_implementation',
  'quality_assurance',
  'general',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type TaskRiskLevel = (typeof TASK_RISK_LEVELS)[number];

export const TASK_ASSIGNMENT_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export type TaskAssignmentStatus = (typeof TASK_ASSIGNMENT_STATUSES)[number];

export const WORKFLOW_PLAN_MODES = ['single', 'serial', 'parallel'] as const;
export type WorkflowPlanMode = (typeof WORKFLOW_PLAN_MODES)[number];

export const TOOL_CATEGORIES = ['knowledge', 'runtime', 'filesystem', 'repository', 'quality'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_DEFINITION_CATEGORIES = TOOL_CATEGORIES;
export type ToolDefinitionCategory = ToolCategory;

export const TOOL_CALL_STATUSES = ['pending', 'running', 'completed', 'failed', 'blocked'] as const;
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

export const TOOL_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number];

export const TASK_EXECUTION_MODES = ['single', 'serial', 'parallel', 'advanced_discussion'] as const;
export type TaskExecutionMode = (typeof TASK_EXECUTION_MODES)[number];

export const DEFAULT_ADVANCED_EXECUTION_MODE: TaskExecutionMode = 'advanced_discussion';

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  taskType: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  executionMode: TaskExecutionMode;
  approvalRequired: boolean;
  riskLevel: TaskRiskLevel;
  requestedBy: string;
  requestedAt: string;
  recommendedAgentRole: string;
  candidateAgentRoles: string[];
  routeReason: string;
  routingStatus: 'matched' | 'manual_review';
  createdAt: string;
  updatedAt: string;
}

export interface TaskRouteInput {
  title: string;
  description: string;
  taskType?: TaskType;
  priority?: TaskPriority;
  requestedBy?: string;
}

export interface TaskRouteDecision {
  taskType: TaskType;
  recommendedAgentRole: string;
  candidateAgentRoles: string[];
  reason: string;
  routingStatus: 'matched' | 'manual_review';
  executionMode: TaskExecutionMode;
}

export interface ApprovalRecord {
  id: string;
  taskId: string;
  taskTitle?: string;           // NEW: Task title for display
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  riskLevel?: ApprovalRiskLevel;  // NEW: Risk level assessment
  approver?: string;           // NEW: Approver name/ID
  approvedAt?: string;         // NEW: When approval was granted/denied
  reason?: string;             // NEW: Reason for decision
  decisionContext?: Record<string, unknown>;  // NEW: Additional context
  resolvedAt?: string;
}

export type TaskAssignmentRole = 'primary' | 'secondary' | 'reviewer' | 'dispatcher';

export interface TaskAssignment {
  id: string;
  taskId: string;
  agentId: string;
  workflowPlanId?: string;
  stepId?: string;
  agentName?: string;
  assignmentRole: TaskAssignmentRole;
  status: TaskAssignmentStatus;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  endedAt?: string;
  completedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export interface WorkflowPlanStep {
  id: string;
  title: string;
  description?: string;
  assignmentId: string;
  agentId: string;
  assignmentRole: TaskAssignmentRole;
  status: TaskAssignmentStatus;
  order?: number;
}

export interface WorkflowPlan {
  id: string;
  taskId: string;
  mode: WorkflowPlanMode;
  synthesisRequired: boolean;
  steps: WorkflowPlanStep[];
  status?: 'planned' | 'running' | 'completed' | 'failed';
  createdAt?: string;
  updatedAt?: string;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  status: ExecutionStatus | 'pending' | 'completed' | 'failed';
  executor?: 'claude' | 'codex' | 'openai';
  runtimeName?: string;
  degraded?: boolean;
  retryCount?: number;
  maxRetries?: number;
  timeoutMs?: number;
  assignmentId?: string;
  assignmentRole?: TaskAssignmentRole;
  workflowStepId?: string;
  workflowPlanId?: string;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  structuredError?: {
    code: 'timeout' | 'runtime_unavailable' | 'execution_failed' | 'degraded' | 'unknown';
    message: string;
    retriable: boolean;
    details?: Record<string, unknown>;
  };
  outputSummary?: string;
  errorMessage?: string;
  memoryContextExcerpt?: string;
  startedAt?: string;
  endedAt?: string;
  completedAt?: string;
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}

export interface ToolDefinition {
  name: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  allowedRoles: string[];
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ToolCallLog {
  id: string;
  toolName: string;
  actorRole: string;
  riskLevel: ToolRiskLevel;
  taskId?: string;
  executionId?: string;
  status: ToolCallStatus;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
  toolId?: string;
  input?: string;
  output?: string;
  createdAt: string;
  updatedAt?: string;
}
