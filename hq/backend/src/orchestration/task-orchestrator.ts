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
import { createApprovalRecord, evaluateApprovalRequirement } from '../governance/approval-service';
import { recommendTaskRoute } from './task-routing';

export interface TaskDraftInput {
  title: string;
  description: string;
  taskType?: string;
  priority?: string;
  requestedBy?: string;
  executionMode?: string;
}

export interface AssignmentPlan {
  assignments: TaskAssignment[];
  workflowPlan: WorkflowPlan;
}

export interface CreateTaskDependencies {
  getAgentProfiles?: () => AgentProfile[];
}

type TaskCreationStore = Pick<
  Store,
  'saveTask' | 'saveApproval' | 'saveTaskAssignment' | 'saveWorkflowPlan'
>;

const TASK_STATE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created: ['routed', 'running', 'waiting_approval', 'cancelled'],
  routed: ['running', 'waiting_approval', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  waiting_approval: ['created', 'routed', 'cancelled'],
  completed: [],
  failed: ['running', 'cancelled'],
  cancelled: [],
};

const ASSIGNMENT_STATE_TRANSITIONS: Record<TaskAssignmentStatus, TaskAssignmentStatus[]> = {
  pending: ['running', 'skipped', 'failed', 'completed'],
  running: ['completed', 'failed', 'skipped'],
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

function buildAssignmentRoleSequence(routeDecision: TaskRouteDecision): Array<{ role: string; assignmentRole: TaskAssignmentRole; title: string }> {
  switch (routeDecision.taskType) {
    case 'architecture_analysis':
      return [
        { role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Analyze architecture and produce recommendation' },
        { role: 'dispatcher', assignmentRole: 'dispatcher', title: 'Consolidate architecture decisions and next steps' },
      ];
    case 'backend_implementation':
    case 'frontend_implementation':
      return routeDecision.executionMode === 'parallel'
        ? [
            { role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Implement the main delivery slice' },
            { role: 'code-reviewer', assignmentRole: 'reviewer', title: 'Review delivery risks and regressions' },
          ]
        : [
            { role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Implement the requested delivery slice' },
            { role: 'code-reviewer', assignmentRole: 'reviewer', title: 'Review implementation for risks and regressions' },
          ];
    case 'code_review':
      return [{ role: routeDecision.recommendedAgentRole, assignmentRole: 'reviewer', title: 'Perform a focused code review' }];
    case 'documentation':
      return [{ role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Produce the requested documentation deliverable' }];
    case 'workflow_dispatch':
      return [
        { role: 'dispatcher', assignmentRole: 'dispatcher', title: 'Split work and coordinate execution path' },
        { role: 'software-architect', assignmentRole: 'secondary', title: 'Validate orchestration and plan quality' },
      ];
    default:
      return [{ role: routeDecision.recommendedAgentRole, assignmentRole: 'primary', title: 'Execute the requested task' }];
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
        description: `${entry.role} owns step ${index + 1} for ${task.title}`,
        assignmentId: assignments[index].id,
        agentId: assignments[index].agentId,
        assignmentRole: assignments[index].assignmentRole,
        status: 'pending',
        order: index + 1,
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
  const approvalDecision = evaluateApprovalRequirement({
    title: input.title.trim(),
    description: input.description.trim(),
  });
  const requestedBy = typeof input.requestedBy === 'string' && input.requestedBy.trim() ? input.requestedBy.trim() : 'system';
  const task: TaskRecord = {
    id: randomUUID(),
    title: input.title.trim(),
    description: input.description.trim(),
    taskType: routeDecision.taskType,
    priority: normalizePriority(input.priority),
    status: approvalDecision.approvalRequired ? 'waiting_approval' : 'routed',
    executionMode: normalizeExecutionMode(input.executionMode, routeDecision.executionMode),
    approvalRequired: approvalDecision.approvalRequired,
    riskLevel: approvalDecision.riskLevel,
    requestedBy,
    requestedAt: now,
    recommendedAgentRole: routeDecision.recommendedAgentRole,
    candidateAgentRoles: routeDecision.candidateAgentRoles,
    routeReason: routeDecision.reason,
    routingStatus: routeDecision.routingStatus,
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
    await createApprovalRecord(task.id, store);
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
