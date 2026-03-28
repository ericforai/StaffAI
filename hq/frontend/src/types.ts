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

export type TaskExecutionMode = 'single' | 'serial' | 'parallel' | 'advanced_discussion';

/** Matches backend `WORKFLOW_PLAN_MODES` — plans do not use `advanced_discussion`. */
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

export interface WorkflowPlanSummary {
  id: string;
  taskId: string;
  mode: WorkflowPlanMode;
  synthesisRequired: boolean;
  steps: WorkflowPlanStep[];
}

export interface TaskAssignmentSummary {
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

export interface TaskSummary {
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
  latestApproval?: ApprovalSummary | null;
  latestExecution?: ExecutionSummary | null;
  canExecute?: boolean;
  workflowPlan?: WorkflowPlanSummary | null;
  assignments?: TaskAssignmentSummary[];
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
  toolCalls?: ToolCallSummary[];
  toolCallLogs?: ToolCallSummary[];
  toolCallLog?: ToolCallSummary[];
  controlState?: {
    executionId: string;
    status: string;
    taskId: string;
    pausedAt?: string;
    resumedAt?: string;
    cancelledAt?: string;
    completedAt?: string;
  };
}

export interface ToolCallSummary {
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

export interface TaskDetailPayload {
  task: TaskSummary;
  approvals: ApprovalSummary[];
  executions: ExecutionSummary[];
  workflowPlan?: WorkflowPlanSummary | null;
  assignments?: TaskAssignmentSummary[];
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
