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

export interface SquadState {
  activeAgentIds: string[];
}

export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  executionMode: string;
  approvalRequired: boolean;
  riskLevel: string;
  recommendedAgentRole: string;
  routingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalSummary {
  id: string;
  taskId: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  resolvedAt?: string;
}

export interface ExecutionSummary {
  id: string;
  taskId: string;
  status: string;
  executor?: 'claude' | 'codex' | 'openai';
  outputSummary?: string;
  errorMessage?: string;
  memoryContextExcerpt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskDetailPayload {
  task: TaskSummary;
  approvals: ApprovalSummary[];
  executions: ExecutionSummary[];
}

export interface TaskEvent {
  type: 'TASK_EVENT';
  taskEventType:
    | 'task_created'
    | 'approval_requested'
    | 'approval_resolved'
    | 'execution_started'
    | 'execution_completed'
    | 'execution_failed'
    | 'execution_degraded';
  message: string;
  taskId?: string;
  approvalId?: string;
  executionId?: string;
  timestamp: string;
}
