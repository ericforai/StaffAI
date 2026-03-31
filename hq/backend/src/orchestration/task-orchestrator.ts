import { randomUUID } from 'node:crypto';
import type { AgentProfile } from '../types';
import type { Store } from '../store';
import type {
  TaskAssignment,
  TaskAssignmentRole,
  TaskAssignmentStatus,
  TaskExecutionMode,
  TaskPriority,
  TaskRecord,
  TaskRouteDecision,
  TaskStatus,
  TaskType,
  WorkflowPlan,
  WorkflowPlanMode,
} from '../shared/task-types';
import {
  TASK_ASSIGNMENT_STATUSES,
  TASK_EXECUTION_MODES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from '../shared/task-types';
import { evaluateApprovalRequirement as evaluateApprovalRequirementV2 } from '../governance/approval-service-v2';
import { createDefaultRiskAssessmentEngine } from '../governance/risk-assessment';
import { recommendTaskRoute } from './task-routing';

export interface TaskDraftInput {
  title: string;
  description: string;
  taskType?: string;
  priority?: string;
  requestedBy?: string;
  executionMode?: string;
  // 任务负责人（从组织架构选择的员工）
  assigneeId?: string;
  assigneeName?: string;
}

export interface AssignmentPlan {
  assignments: TaskAssignment[];
  workflowPlan: WorkflowPlan;
}

export interface CreateTaskDependencies {
  getAgentProfiles?: () => AgentProfile[];
}

export type TaskCreationStore = Pick<
  Store,
  'saveTask' | 'saveApproval' | 'saveTaskAssignment' | 'saveWorkflowPlan' | 'getTasks' | 'getTaskById'
>;

/**
 * Generate a sequential task ID based on current date (YYYYMMDDNNN)
 * e.g., 20260326001
 *
 * Uses getById-based probing to avoid the read-then-max race condition
 * under concurrent access. Falls back to UUID if 10 sequential slots are taken.
 */
export async function generateTaskId(
  store: Pick<Store, 'getTasks' | 'getTaskById'>,
): Promise<string> {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  // Try up to 10 sequential IDs, probing for uniqueness each time
  for (let seq = 1; seq <= 10; seq++) {
    const candidate = `${dateStr}${String(seq).padStart(3, '0')}`;
    const existing = await store.getTaskById(candidate);
    if (!existing) return candidate;
  }

  // Fallback to UUID if all sequential IDs taken
  const { randomUUID } = await import('node:crypto');
  return randomUUID();
}

const TASK_STATE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created: ['routed', 'running', 'waiting_approval', 'cancelled'],
  routed: ['running', 'waiting_approval', 'cancelled'],
  queued: ['running', 'waiting_approval', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  waiting_approval: ['created', 'routed', 'cancelled'],
  completed: [],
  failed: ['running', 'cancelled'],
  cancelled: [],
};

const ASSIGNMENT_STATE_TRANSITIONS: Record<TaskAssignmentStatus, TaskAssignmentStatus[]> = {
  pending: ['running', 'skipped', 'failed', 'completed'],
  running: ['completed', 'failed', 'skipped', 'waiting_input'],
  waiting_input: ['running', 'completed', 'failed', 'skipped'],
  completed: [],
  failed: ['pending', 'running'],
  skipped: ['pending'],
};

function normalizeTaskType(value: unknown): TaskType | undefined {
  if (typeof value !== 'string') return undefined;
  return (TASK_TYPES as readonly string[]).includes(value) ? (value as TaskType) : undefined;
}

function normalizePriority(value: unknown): TaskPriority {
  if (typeof value !== 'string') return 'medium';
  return (TASK_PRIORITIES as readonly string[]).includes(value) ? (value as TaskPriority) : 'medium';
}

function normalizeExecutionMode(value: unknown, fallback: TaskExecutionMode): TaskExecutionMode {
  if (typeof value !== 'string') return fallback;
  return (TASK_EXECUTION_MODES as readonly string[]).includes(value) ? (value as TaskExecutionMode) : fallback;
}

function inferPlanMode(executionMode: TaskExecutionMode): WorkflowPlanMode {
  if (executionMode === 'parallel') return 'parallel';
  if (executionMode === 'serial') return 'serial';
  return 'single';
}

type RoleSequenceEntry = {
  role: string;
  assignmentRole: TaskAssignmentRole;
  title: string;
  order?: number;
};

export function buildAssignmentRoleSequence(routeDecision: TaskRouteDecision): RoleSequenceEntry[] {
  switch (routeDecision.taskType) {
    case 'architecture':
    case 'architecture_analysis':
      return [
        { role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: '执行架构评估与技术决策' },
        { role: 'dispatcher', assignmentRole: 'dispatcher', title: '汇总架构结论并推进后续任务' },
      ];
    case 'backend_implementation':
    case 'frontend_implementation':
      if (routeDecision.executionMode === 'serial' || routeDecision.executionMode === 'advanced_discussion') {
        return [
          { role: 'dispatcher', assignmentRole: 'dispatcher', title: 'Analyze requirements and dispatch implementation tasks' },
          { role: 'software-architect', assignmentRole: 'secondary', title: 'Design architecture and technical approach' },
          { role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Implement the requested delivery slice' },
          { role: 'code-reviewer', assignmentRole: 'reviewer', title: 'Review implementation for risks and regressions' },
          { role: 'technical-writer', assignmentRole: 'secondary', title: 'Produce documentation for the implementation' },
        ];
      }
      return [
        { role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Implement the requested delivery slice' },
        { role: 'code-reviewer', assignmentRole: 'reviewer', title: 'Review implementation for risks and regressions' },
      ];
    case 'code_review':
      return [{ role: routeDecision.recommendedAgentRole, assignmentRole: 'reviewer', title: 'Perform a focused code review' }];
    case 'documentation':
      return [{ role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Produce the requested documentation deliverable', order: 1 }];
    case 'workflow_dispatch':
      return [
        { role: 'dispatcher', assignmentRole: 'dispatcher', title: '拆分任务并协调执行路径', order: 1 },
        { role: 'software-architect', assignmentRole: 'secondary', title: '验证编排和计划质量', order: 2 },
      ];
    case 'feature_delivery':
      return [
        { role: 'sprint-prioritizer', assignmentRole: 'primary', title: 'Refine product requirements and acceptance criteria', order: 1 },
        { role: 'software-architect', assignmentRole: 'secondary', title: 'Define module boundaries and API contracts', order: 2 },
        { role: 'frontend-developer', assignmentRole: 'executor', title: 'Implement frontend components and state flow', order: 3 },
        { role: 'backend-architect', assignmentRole: 'executor', title: 'Implement backend services and data persistence', order: 4 },
        { role: 'security-engineer', assignmentRole: 'reviewer', title: 'Review security posture and permission boundaries', order: 5 },
        { role: 'code-reviewer', assignmentRole: 'reviewer', title: 'Final system-wide review and integration check', order: 6 },
      ];
    default:
      return [{ role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: '执行任务', order: 1 }];
  }
}

function resolveAgentForRole(role: string, profiles: AgentProfile[]): { agentId: string; agentName?: string } {
  const exact = profiles.find((profile) => profile.role === role);
  if (exact) {
    return { agentId: exact.id, agentName: exact.name };
  }

  const byTaskType = profiles.find((profile) => profile.allowedTaskTypes.includes('general'));
  if (byTaskType && role === 'dispatcher') {
    return { agentId: byTaskType.id, agentName: byTaskType.name };
  }

  return { agentId: role };
}

export function validateTaskDraft(input: TaskDraftInput) {
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title || !description) {
    return {
      valid: false as const,
      error: 'title and description are required',
    };
  }

  return {
    valid: true as const,
    error: undefined,
  };
}

export function routeTask(input: TaskDraftInput): TaskRouteDecision {
  return recommendTaskRoute({
    title: input.title.trim(),
    description: input.description.trim(),
    taskType: normalizeTaskType(input.taskType),
    priority: normalizePriority(input.priority),
    requestedBy: typeof input.requestedBy === 'string' && input.requestedBy.trim() ? input.requestedBy.trim() : 'system',
  });
}

/**
 * Rebuild workflow plan + assignments for serial execution from the task's routing metadata.
 * Used when persisted plans are missing, parallel, or inconsistent (e.g. parallel degraded to serial).
 */
export function rebuildWorkflowBundleForSerialExecution(
  task: TaskRecord,
  profiles: AgentProfile[] = [],
): AssignmentPlan {
  const routeDecision = routeTask({
    title: task.title,
    description: task.description,
    taskType: task.taskType,
    priority: task.priority,
    requestedBy: task.requestedBy,
    executionMode: 'serial',
  });
  const taskForPlan: TaskRecord = { ...task, executionMode: 'serial' };
  const structuredPlan = buildPlan(taskForPlan, routeDecision);
  return assignAgents(structuredPlan, routeDecision, profiles);
}

export function buildPlan(task: TaskRecord, routeDecision: TaskRouteDecision): AssignmentPlan {
  const now = new Date().toISOString();
  const workflowPlanId = randomUUID();
  const planMode = inferPlanMode(task.executionMode);
  const roleSequence = buildAssignmentRoleSequence(routeDecision);

  const assignments: TaskAssignment[] = roleSequence.map((entry, index) => {
    const assignmentId = randomUUID();
    return {
      id: assignmentId,
      taskId: task.id,
      workflowPlanId,
      assignmentRole: entry.assignmentRole,
      agentId: entry.role,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    assignments,
    workflowPlan: {
      id: workflowPlanId,
      taskId: task.id,
      mode: planMode,
      synthesisRequired: planMode !== 'single' || task.executionMode === 'advanced_discussion',
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      steps: roleSequence.map((entry, index) => ({
        id: randomUUID(),
        title: entry.title,
        description: `为任务「${task.title}」执行步骤 ${index + 1}`,
        assignmentId: assignments[index].id,
        agentId: assignments[index].agentId,
        assignmentRole: assignments[index].assignmentRole,
        status: 'pending',
        order: entry.order ?? (task.executionMode === 'parallel' ? 1 : index + 1),
      })),
    },
  };
}

export function assignAgents(plan: AssignmentPlan, routeDecision: TaskRouteDecision, profiles: AgentProfile[] = []): AssignmentPlan {
  const assigned = plan.assignments.map((assignment, index) => {
    const role = routeDecision.candidateAgentRoles[index] || assignment.agentId;
    const resolved = resolveAgentForRole(role, profiles);
    return {
      ...assignment,
      agentId: resolved.agentId,
      agentName: resolved.agentName,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    assignments: assigned,
    workflowPlan: {
      ...plan.workflowPlan,
      steps: plan.workflowPlan.steps.map((step, index) => ({
        ...step,
        assignmentId: assigned[index].id,
        agentId: assigned[index].agentId,
        assignmentRole: assigned[index].assignmentRole,
      })),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function advanceTaskState(task: TaskRecord, nextStatus: TaskStatus): TaskRecord {
  if (!(TASK_STATUSES as readonly string[]).includes(nextStatus)) {
    throw new Error(`unknown task status transition target: ${nextStatus}`);
  }

  if (!TASK_STATE_TRANSITIONS[task.status].includes(nextStatus)) {
    throw new Error(`invalid task status transition: ${task.status} -> ${nextStatus}`);
  }

  return {
    ...task,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function advanceAssignmentState(assignment: TaskAssignment, nextStatus: TaskAssignmentStatus): TaskAssignment {
  if (!(TASK_ASSIGNMENT_STATUSES as readonly string[]).includes(nextStatus)) {
    throw new Error(`unknown assignment status transition target: ${nextStatus}`);
  }

  if (!ASSIGNMENT_STATE_TRANSITIONS[assignment.status].includes(nextStatus)) {
    throw new Error(`invalid assignment status transition: ${assignment.status} -> ${nextStatus}`);
  }

  const now = new Date().toISOString();
  return {
    ...assignment,
    status: nextStatus,
    startedAt: nextStatus === 'running' ? assignment.startedAt ?? now : assignment.startedAt,
    endedAt: nextStatus === 'completed' || nextStatus === 'failed' || nextStatus === 'skipped' ? now : assignment.endedAt,
    completedAt: nextStatus === 'completed' ? now : assignment.completedAt,
    updatedAt: now,
  };
}

export async function createTask(
  input: TaskDraftInput,
  store: TaskCreationStore,
  dependencies: CreateTaskDependencies = {},
): Promise<{ task: TaskRecord; routeDecision: TaskRouteDecision; workflowPlan: WorkflowPlan; assignments: TaskAssignment[] }> {
  const now = new Date().toISOString();
  const routeDecision = routeTask(input);

  // Use ApprovalServiceV2 for enhanced risk assessment
  const approvalDecision = evaluateApprovalRequirementV2({
    title: input.title.trim(),
    description: input.description.trim(),
  });
  const requestedBy = typeof input.requestedBy === 'string' && input.requestedBy.trim() ? input.requestedBy.trim() : 'system';
  const taskId = await generateTaskId(store);
  const task: TaskRecord = {
    id: taskId,
    title: input.title.trim(),
    description: input.description.trim(),
    taskType: routeDecision.taskType,
    priority: normalizePriority(input.priority),
    status: approvalDecision.approvalRequired ? 'waiting_approval' : 'routed',
    executionMode: normalizeExecutionMode(input.executionMode, routeDecision.executionMode),
    approvalRequired: approvalDecision.approvalRequired,
    riskLevel: approvalDecision.riskLevel.toLowerCase() as 'low' | 'medium' | 'high',
    requestedBy,
    requestedAt: now,
    recommendedAgentRole: routeDecision.recommendedAgentRole,
    candidateAgentRoles: routeDecision.candidateAgentRoles,
    routeReason: routeDecision.reason,
    routingStatus: routeDecision.routingStatus,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    createdAt: now,
    updatedAt: now,
  };

  const structuredPlan = buildPlan(task, routeDecision);
  const assignedPlan = assignAgents(structuredPlan, routeDecision, dependencies.getAgentProfiles?.() || []);

  await store.saveTask(task);
  for (const assignment of assignedPlan.assignments) {
    await store.saveTaskAssignment(assignment);
  }
  await store.saveWorkflowPlan(assignedPlan.workflowPlan);

  if (approvalDecision.approvalRequired) {
    const riskEngine = createDefaultRiskAssessmentEngine();
    const riskAssessment = riskEngine.assess({
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      executionMode: task.executionMode,
      priority: task.priority,
    });

    await store.saveApproval({
      id: randomUUID(),
      taskId: task.id,
      taskTitle: task.title,
      status: 'pending',
      requestedBy,
      requestedAt: now,
      riskLevel: riskAssessment.riskLevel,
      decisionContext: {
        factors: riskAssessment.factors,
        confidence: riskAssessment.confidence,
      },
    });
  }

  return {
    task,
    routeDecision,
    workflowPlan: assignedPlan.workflowPlan,
    assignments: assignedPlan.assignments,
  };
}

export async function createTaskDraft(
  input: TaskDraftInput,
  store: TaskCreationStore,
  dependencies: CreateTaskDependencies = {},
): Promise<TaskRecord> {
  const result = await createTask(input, store, dependencies);
  return result.task;
}
