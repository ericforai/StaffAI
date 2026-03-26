/**
 * Task Lifecycle Service
 *
 * Orchestrates task creation and approval workflows using ApprovalServiceV2
 * for risk assessment and approval management.
 *
 * This service provides a high-level interface for:
 * - Creating tasks with automatic risk assessment
 * - Requesting approvals for tasks
 * - Handling approval decisions
 * - Managing task status transitions related to approvals
 */

import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type {
  ApprovalRecord,
  ApprovalRiskLevel,
  TaskRecord,
  TaskRiskLevel,
  TaskStatus,
  TaskType,
  TaskPriority,
  TaskExecutionMode,
} from '../shared/task-types';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_EXECUTION_MODES,
  APPROVAL_RISK_LEVELS,
} from '../shared/task-types';
import {
  ApprovalServiceV2,
  createApprovalServiceV2,
  type ApprovalServiceDependencies,
  type CreateApprovalInput,
  type ApprovalDecisionInput,
  type CancelApprovalInput,
  ApprovalNotFoundError,
  InvalidApprovalStateError,
} from '../governance/approval-service-v2';
import type { AuditEvent } from '../governance/audit-logger';
import { RiskAssessmentEngine, type RiskAssessmentResult } from '../governance/risk-assessment';

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Optional task type */
  taskType?: string;
  /** Optional priority level */
  priority?: string;
  /** Optional execution mode */
  executionMode?: string;
  /** User requesting the task */
  requestedBy: string;
}

/**
 * Result of task creation
 */
export interface TaskCreationResult {
  /** The created task */
  task: TaskRecord;
  /** Risk assessment result */
  riskAssessment: RiskAssessmentResult;
  /** Approval record if approval was required */
  approval?: ApprovalRecord;
}

/**
 * Dependencies for TaskLifecycleService
 */
export interface TaskLifecycleDependencies {
  /** Store for persistence */
  store: Store;
  /** Optional audit logger */
  auditLogger?: {
    log: (event: AuditEvent) => Promise<void>;
  };
  /** Optional custom approval service */
  approvalService?: ApprovalServiceV2;
}

/**
 * Normalizes task type to valid enum value
 */
function normalizeTaskType(value: unknown): TaskType {
  if (typeof value !== 'string') return 'general';
  return (TASK_TYPES as readonly string[]).includes(value)
    ? (value as TaskType)
    : 'general';
}

/**
 * Normalizes priority to valid enum value
 */
function normalizePriority(value: unknown): TaskPriority {
  if (typeof value !== 'string') return 'medium';
  return (TASK_PRIORITIES as readonly string[]).includes(value)
    ? (value as TaskPriority)
    : 'medium';
}

/**
 * Normalizes execution mode to valid enum value
 */
function normalizeExecutionMode(
  value: unknown,
  fallback: TaskExecutionMode
): TaskExecutionMode {
  if (typeof value !== 'string') return fallback;
  return (TASK_EXECUTION_MODES as readonly string[]).includes(value)
    ? (value as TaskExecutionMode)
    : fallback;
}

/**
 * Maps approval risk level to task risk level
 */
function mapToTaskRiskLevel(riskLevel: ApprovalRiskLevel): TaskRiskLevel {
  return riskLevel.toLowerCase() as TaskRiskLevel;
}

/**
 * Determines initial task status based on approval requirement
 */
function getInitialTaskStatus(approvalRequired: boolean): TaskStatus {
  return approvalRequired ? 'waiting_approval' : 'routed';
}

/**
 * Task Lifecycle Service
 *
 * Provides high-level task lifecycle operations with integrated
 * risk assessment and approval workflows.
 */
export class TaskLifecycleService {
  private approvalService: ApprovalServiceV2;
  private riskEngine: RiskAssessmentEngine;
  private store: Store;
  private auditLogger?: TaskLifecycleDependencies['auditLogger'];

  constructor(dependencies: TaskLifecycleDependencies) {
    this.store = dependencies.store;
    this.auditLogger = dependencies.auditLogger;

    // Initialize risk assessment engine
    const { createDefaultRiskAssessmentEngine } = require('../governance/risk-assessment');
    this.riskEngine = createDefaultRiskAssessmentEngine();

    // Use provided approval service or create default
    this.approvalService =
      dependencies.approvalService ||
      createApprovalServiceV2({
        store: this.store,
        auditLogger: this.auditLogger,
      });
  }

  /**
   * Create a new task with automatic risk assessment
   *
   * - Assesses risk level based on task content
   * - Creates approval if required
   * - Sets initial status based on approval requirement
   */
  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const now = new Date().toISOString();
    const taskType = normalizeTaskType(input.taskType);
    const priority = normalizePriority(input.priority);
    const executionMode = normalizeExecutionMode(
      input.executionMode,
      'single'
    );

    // Assess risk for the task
    const riskAssessment = this.riskEngine.assess({
      title: input.title,
      description: input.description,
      taskType,
      executionMode,
      priority,
    });

    const approvalRequired = riskAssessment.approvalRequired;
    const riskLevel = mapToTaskRiskLevel(riskAssessment.riskLevel);
    const status = getInitialTaskStatus(approvalRequired);

    // Create the task record
    const task: TaskRecord = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      taskType,
      priority,
      status,
      executionMode,
      approvalRequired,
      riskLevel,
      requestedBy: input.requestedBy,
      requestedAt: now,
      recommendedAgentRole: this.recommendAgentForTaskType(taskType),
      candidateAgentRoles: [this.recommendAgentForTaskType(taskType)],
      routeReason: riskAssessment.factors.join(', '),
      routingStatus: approvalRequired ? 'manual_review' : 'matched',
      createdAt: now,
      updatedAt: now,
    };

    // Save task to store
    await this.store.saveTask(task);

    // Create approval if required
    if (approvalRequired) {
      await this.approvalService.createApproval({
        taskId: task.id,
        taskTitle: task.title,
        requestedBy: input.requestedBy,
        task,
      });

      // Log audit event
      await this.logAuditEvent({
        entityType: 'task',
        entityId: task.id,
        action: 'created_waiting_approval',
        actor: input.requestedBy,
        newState: { status, riskLevel },
        reason: `Risk: ${riskAssessment.riskLevel} - ${riskAssessment.factors.join(', ')}`,
      });
    } else {
      // Log audit event for non-approval tasks
      await this.logAuditEvent({
        entityType: 'task',
        entityId: task.id,
        action: 'created_routed',
        actor: input.requestedBy,
        newState: { status, riskLevel },
      });
    }

    return task;
  }

  /**
   * Request approval for an existing task
   *
   * Creates an approval record and updates task status to waiting_approval
   */
  async requestApproval(taskId: string, reason?: string): Promise<ApprovalRecord> {
    const task = await this.store.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Create approval
    const approval = await this.approvalService.createApproval({
      taskId,
      taskTitle: task.title,
      requestedBy: task.requestedBy,
      task,
    });

    // Update task status
    await this.store.updateTask(taskId, (current) => ({
      ...current,
      status: 'waiting_approval',
      approvalRequired: true,
      updatedAt: new Date().toISOString(),
    }));

    // Log audit event
    await this.logAuditEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'approval_requested',
      actor: task.requestedBy,
      previousState: { status: task.status },
      newState: { status: 'waiting_approval' },
      reason,
    });

    return approval;
  }

  /**
   * Handle an approval decision (approve or reject)
   *
   * Updates both approval and task status based on the decision
   */
  async handleApprovalDecision(
    approvalId: string,
    decision: 'approved' | 'rejected',
    approver: string,
    reason?: string
  ): Promise<{ approval: ApprovalRecord | null; task: TaskRecord | null }> {
    // Process the approval decision
    let approval: ApprovalRecord | null = null;

    if (decision === 'approved') {
      approval = await this.approvalService.approve({
        approvalId,
        approver,
        decision: 'approved',
        reason,
      });
    } else {
      approval = await this.approvalService.reject({
        approvalId,
        approver,
        decision: 'rejected',
        reason,
      });
    }

    if (!approval) {
      return { approval: null, task: null };
    }

    // Update task status based on decision
    const task = await this.store.updateTask(approval.taskId, (current) => {
      const newStatus = decision === 'approved' ? 'routed' : 'cancelled';
      return {
        ...current,
        status: newStatus,
        approvalRequired: decision !== 'approved',
        updatedAt: new Date().toISOString(),
      };
    });

    // Log audit event
    if (task) {
      await this.logAuditEvent({
        entityType: 'task',
        entityId: task.id,
        action: decision === 'approved' ? 'approval_approved' : 'approval_rejected',
        actor: approver,
        previousState: { status: decision === 'approved' ? 'waiting_approval' : 'waiting_approval' },
        newState: { status: task.status },
        reason,
      });
    }

    return { approval, task };
  }

  /**
   * Cancel a pending approval for a task
   *
   * Cancels the approval and marks the task as cancelled
   */
  async cancelApproval(
    taskId: string,
    actor: string,
    reason?: string
  ): Promise<void> {
    // Get pending approvals for the task
    const approvals = await this.approvalService.getApprovalsByTaskId(taskId);
    const pendingApproval = approvals.find((a) => a.status === 'pending');

    if (pendingApproval) {
      try {
        await this.approvalService.cancel({
          approvalId: pendingApproval.id,
          actor,
          reason,
        });
      } catch (error) {
        // Ignore InvalidApprovalStateError - approval may already be processed
        if (!(error instanceof InvalidApprovalStateError)) {
          throw error;
        }
      }
    }

    // Update task status to cancelled
    await this.store.updateTask(taskId, (current) => ({
      ...current,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }));

    // Log audit event
    await this.logAuditEvent({
      entityType: 'task',
      entityId: taskId,
      action: 'approval_cancelled',
      actor,
      reason,
    });
  }

  /**
   * Assess risk level for a task (without creating it)
   *
   * Useful for pre-validation and UI feedback
   */
  assessTaskRisk(input: {
    title: string;
    description: string;
    taskType?: string;
    executionMode?: string;
    priority?: string;
  }): RiskAssessmentResult {
    return this.riskEngine.assess(input);
  }

  /**
   * Check if a task requires approval
   */
  async requiresApproval(taskId: string): Promise<boolean> {
    return this.approvalService.requiresApproval(taskId);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Recommend an agent role for a given task type
   */
  private recommendAgentForTaskType(taskType: TaskType): string {
    const agentMapping: Record<TaskType, string> = {
      architecture: 'software-architect',
      architecture_analysis: 'software-architect',
      backend_implementation: 'backend-developer',
      'code_review': 'code-reviewer',
      documentation: 'technical-writer',
      backend_design: 'backend-architect',
      workflow_dispatch: 'dispatcher',
      frontend_implementation: 'frontend-developer',
      quality_assurance: 'qa-engineer',
      general: 'dispatcher',
    };

    return agentMapping[taskType] || 'dispatcher';
  }

  /**
   * Log an audit event
   */
  private async logAuditEvent(event: AuditEvent): Promise<void> {
    if (this.auditLogger) {
      await this.auditLogger.log(event);
    }
  }
}

/**
 * Factory function to create TaskLifecycleService
 */
export function createTaskLifecycleService(
  dependencies: TaskLifecycleDependencies
): TaskLifecycleService {
  return new TaskLifecycleService(dependencies);
}
