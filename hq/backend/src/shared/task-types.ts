export const TASK_STATUSES = [
  'created',
  'routed',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed', 'degraded'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const TASK_EXECUTION_MODES = ['single', 'serial', 'parallel', 'advanced_discussion'] as const;
export type TaskExecutionMode = (typeof TASK_EXECUTION_MODES)[number];

export const DEFAULT_ADVANCED_EXECUTION_MODE: TaskExecutionMode = 'advanced_discussion';

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  executionMode: TaskExecutionMode;
  approvalRequired: boolean;
  riskLevel: 'low' | 'high';
  recommendedAgentRole: string;
  routingStatus: 'matched' | 'manual_review';
  createdAt: string;
  updatedAt: string;
}

export interface TaskRouteInput {
  title: string;
  description: string;
}

export interface TaskRouteDecision {
  recommendedAgentRole: string;
  routingStatus: 'matched' | 'manual_review';
  executionMode: TaskExecutionMode;
}

export interface ApprovalRecord {
  id: string;
  taskId: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  resolvedAt?: string;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  status: ExecutionStatus | 'pending' | 'completed' | 'failed';
  executor?: 'claude' | 'codex' | 'openai';
  outputSummary?: string;
  errorMessage?: string;
  memoryContextExcerpt?: string;
  startedAt?: string;
  completedAt?: string;
}
