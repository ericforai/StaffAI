export const TASK_ENVELOPE_V2_VERSION = '2.0' as const;

export interface TaskMetadataGroup {
  taskId: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  executionMode: string;
  requestedBy: string;
  requestedAt: string;
}

export interface RoutingGroup {
  assigneeId?: string;
  assigneeName?: string;
  recommendedAgentRole: string;
  candidateAgentRoles: string[];
  routeReason: string;
}

export interface ApprovalContextGroup {
  approvalRequired: boolean;
  riskLevel: string;
  approvalId?: string;
}

export interface MemoryContextGroup {
  profileExcerpt?: string;
  layerHints?: {
    preferL1?: boolean;
    preferL2?: boolean;
    preferL3?: boolean;
  };
}

export interface BudgetControlGroup {
  timeoutMs?: number;
  maxRetries?: number;
  maxTokens?: number;
}

export interface ToolPolicyGroup {
  allowedTools?: string[];
  blockedTools?: string[];
  riskThreshold?: string;
}

export interface CheckpointGroup {
  checkpointRef?: string;
  threadId?: string;
  parentExecutionId?: string;
}

export interface RuntimeControlGroup {
  executor: string;
  degraded?: boolean;
  runtimeName?: string;
  sessionCapabilities?: {
    sampling: boolean;
  };
}

export interface TaskEnvelopeV2 {
  version: typeof TASK_ENVELOPE_V2_VERSION;
  taskMetadata: TaskMetadataGroup;
  routing: RoutingGroup;
  approvalContext: ApprovalContextGroup;
  memoryContext: MemoryContextGroup;
  budgetControl: BudgetControlGroup;
  toolPolicy: ToolPolicyGroup;
  checkpoint: CheckpointGroup;
  runtimeControl: RuntimeControlGroup;
}

export interface CreateTaskEnvelopeV2Input {
  taskMetadata: TaskMetadataGroup;
  routing: RoutingGroup;
  approvalContext: ApprovalContextGroup;
  memoryContext?: MemoryContextGroup;
  budgetControl?: BudgetControlGroup;
  toolPolicy?: ToolPolicyGroup;
  checkpoint?: CheckpointGroup;
  runtimeControl: RuntimeControlGroup;
}

export function createTaskEnvelopeV2(input: CreateTaskEnvelopeV2Input): TaskEnvelopeV2 {
  return {
    version: TASK_ENVELOPE_V2_VERSION,
    taskMetadata: input.taskMetadata,
    routing: input.routing,
    approvalContext: input.approvalContext,
    memoryContext: input.memoryContext ?? {},
    budgetControl: input.budgetControl ?? {},
    toolPolicy: input.toolPolicy ?? {},
    checkpoint: input.checkpoint ?? {},
    runtimeControl: input.runtimeControl,
  };
}

export interface LegacyTaskEnvelopeV1 {
  task_id: string;
  action: string;
  agent_role?: string;
  identity_context?: string;
  description?: string;
  memory_context?: string;
  payload?: Record<string, unknown>;
}

export function parseEnvelope(raw: Record<string, unknown>): TaskEnvelopeV2 {
  if (raw.version === TASK_ENVELOPE_V2_VERSION && raw.taskMetadata && raw.routing) {
    return raw as unknown as TaskEnvelopeV2;
  }

  const v1 = raw as unknown as LegacyTaskEnvelopeV1;
  return createTaskEnvelopeV2({
    taskMetadata: {
      taskId: v1.task_id ?? '',
      title: v1.action ?? '',
      description: v1.description ?? '',
      taskType: 'general',
      priority: 'medium',
      executionMode: 'single',
      requestedBy: 'system',
      requestedAt: new Date().toISOString(),
    },
    routing: {
      recommendedAgentRole: v1.agent_role ?? 'dispatcher',
      candidateAgentRoles: v1.agent_role ? [v1.agent_role] : ['dispatcher'],
      routeReason: 'Migrated from v1 envelope',
    },
    approvalContext: {
      approvalRequired: false,
      riskLevel: 'low',
    },
    memoryContext: v1.memory_context
      ? { profileExcerpt: v1.memory_context }
      : {},
    runtimeControl: {
      executor: 'deerflow',
    },
  });
}

export function serializeEnvelope(envelope: TaskEnvelopeV2): Record<string, unknown> {
  return { ...envelope } as Record<string, unknown>;
}
