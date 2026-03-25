/**
 * Approval Service v2 - Enhanced with Risk Assessment
 *
 * Enhanced approval service with:
 * - Three-tier risk assessment (LOW/MEDIUM/HIGH)
 * - Approval record with extended fields (via JSON storage)
 * - Audit logging integration
 * - Cancel approval capability
 * - Backward compatibility with existing Store interface
 */

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { AuditEvent } from './audit-logger';
import type {
  ApprovalRecord,
  ApprovalRiskLevel,
  ApprovalStatus,
  TaskRecord,
} from '../shared/task-types';
import {
  RiskAssessmentEngine,
  type RiskAssessmentInput,
  type RiskAssessmentResult,
  type RiskPolicyRule,
} from './risk-assessment';

/**
 * Custom error types for approval operations
 */
export class ApprovalNotFoundError extends Error {
  constructor(public readonly approvalId: string) {
    super(`Approval ${approvalId} not found`);
    this.name = 'ApprovalNotFoundError';
  }
}

export class InvalidApprovalStateError extends Error {
  constructor(
    public readonly approvalId: string,
    public readonly currentStatus: ApprovalStatus,
    public readonly requiredStatus: ApprovalStatus
  ) {
    super(`Cannot modify approval ${approvalId}: current status is ${currentStatus}, required ${requiredStatus}`);
    this.name = 'InvalidApprovalStateError';
  }
}

/**
 * Extended approval record with additional fields (stored in JSON)
 */
interface ExtendedApprovalRecord extends ApprovalRecord {
  taskTitle?: string;
  riskLevel?: ApprovalRiskLevel;
  approver?: string;
  approvedAt?: string;
  reason?: string;
  decisionContext?: Record<string, unknown>;
}

/**
 * Enhanced approval input
 */
export interface CreateApprovalInput {
  taskId: string;
  taskTitle?: string;
  requestedBy: string;
  task?: TaskRecord;
}

/**
 * Approval decision with reasoning
 */
export interface ApprovalDecisionInput {
  approvalId: string;
  approver: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}

/**
 * Cancel approval input
 */
export interface CancelApprovalInput {
  approvalId: string;
  actor: string;
  reason?: string;
}

/**
 * Approval service dependencies
 */
export interface ApprovalServiceDependencies {
  store: Store;
  auditLogger?: {
    log: (event: AuditEvent) => Promise<unknown>;
  };
  riskEngine?: RiskAssessmentEngine;
}

/**
 * Extended approval service class
 */
export class ApprovalServiceV2 {
  private riskEngine: RiskAssessmentEngine;

  constructor(
    private dependencies: ApprovalServiceDependencies,
    riskRules?: RiskPolicyRule[]
  ) {
    // Import RiskAssessmentEngine dynamically
    const { createDefaultRiskAssessmentEngine } = require('./risk-assessment');
    this.riskEngine = riskRules
      ? new RiskAssessmentEngine(riskRules)
      : createDefaultRiskAssessmentEngine();
  }

  /**
   * Create a new approval record
   */
  async createApproval(input: CreateApprovalInput): Promise<ApprovalRecord> {
    // Fetch task if not provided
    let task = input.task;
    if (!task) {
      const fetchedTask = await this.dependencies.store.getTaskById(input.taskId);
      task = fetchedTask ?? undefined;
    }

    // Assess risk
    const riskResult = this.assessRisk({ ...input, task });

    // Create base approval record (Store compatible)
    const approval: ApprovalRecord = {
      id: randomUUID(),
      taskId: input.taskId,
      status: 'pending',
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString(),
    };

    // Save to Store
    await this.dependencies.store.saveApproval(approval);

    // Store extended fields separately (in auxiliary storage)
    await this.saveExtendedApproval(approval.id, {
      taskTitle: input.taskTitle || input.task?.title,
      riskLevel: riskResult.riskLevel,
    });

    // Log audit event
    await this.logAuditEvent({
      entityType: 'approval',
      entityId: approval.id,
      action: 'created',
      actor: input.requestedBy,
      newState: { ...approval } as Record<string, unknown>,
      reason: `Risk: ${riskResult.riskLevel} - ${riskResult.factors.join(', ')}`,
    });

    return approval;
  }

  /**
   * Approve an approval
   */
  async approve(input: ApprovalDecisionInput): Promise<ApprovalRecord | null> {
    return this.applyDecision(input, 'approved');
  }

  /**
   * Reject an approval
   */
  async reject(input: ApprovalDecisionInput): Promise<ApprovalRecord | null> {
    return this.applyDecision(input, 'rejected');
  }

  /**
   * Cancel an approval
   */
  async cancel(input: CancelApprovalInput): Promise<ApprovalRecord | null> {
    const existing = await this.getApproval(input.approvalId);
    if (!existing) {
      throw new ApprovalNotFoundError(input.approvalId);
    }

    if (existing.status !== 'pending') {
      throw new InvalidApprovalStateError(input.approvalId, existing.status, 'pending');
    }

    // Update status (using cancelled status)
    const updated = await this.dependencies.store.updateApprovalStatus(
      input.approvalId,
      'cancelled',
      input.actor
    );

    if (!updated) return null;

    // Store extended fields
    await this.saveExtendedApproval(input.approvalId, {
      reason: input.reason,
    });

    // Log audit event
    await this.logAuditEvent({
      entityType: 'approval',
      entityId: input.approvalId,
      action: 'cancelled',
      actor: input.actor,
      previousState: { status: 'pending' },
      newState: { status: 'cancelled' },
      reason: input.reason,
    });

    return updated;
  }

  private async applyDecision(
    input: ApprovalDecisionInput,
    status: 'approved' | 'rejected'
  ): Promise<ApprovalRecord | null> {
    const existing = await this.getApproval(input.approvalId);
    if (!existing) {
      return null;
    }

    const updated = await this.dependencies.store.updateApprovalStatus(
      input.approvalId,
      status,
      input.approver
    );
    if (!updated) {
      return null;
    }

    await this.saveExtendedApproval(input.approvalId, {
      approver: input.approver,
      approvedAt: new Date().toISOString(),
      reason: input.reason,
    });

    await this.logAuditEvent({
      entityType: 'approval',
      entityId: input.approvalId,
      action: status,
      actor: input.approver,
      previousState: { status: 'pending' },
      newState: { status },
      reason: input.reason,
    });

    return updated;
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(): Promise<ApprovalRecord[]> {
    const approvals = await this.dependencies.store.getApprovals();
    return approvals.filter(a => a.status === 'pending');
  }

  /**
   * Get approvals by task ID
   */
  async getApprovalsByTaskId(taskId: string): Promise<ApprovalRecord[]> {
    const approvals = await this.dependencies.store.getApprovals();
    return approvals.filter(a => a.taskId === taskId);
  }

  /**
   * Get extended approval with additional fields
   */
  async getExtendedApproval(approvalId: string): Promise<(ApprovalRecord & ExtendedApprovalRecord) | null> {
    const base = await this.getApproval(approvalId);
    if (!base) return null;

    const extended = await this.loadExtendedApproval(approvalId);
    return { ...base, ...extended };
  }

  /**
   * Assess risk level for a task
   */
  assessRisk(input: CreateApprovalInput | TaskRecord): RiskAssessmentResult {
    let task: TaskRecord | undefined;

    // Use 'taskId' as discriminator for CreateApprovalInput
    // TaskRecord has 'id' not 'taskId'
    if ('taskId' in input) {
      task = input.task;
    } else {
      task = input as TaskRecord;
    }

    const assessmentInput: RiskAssessmentInput = {
      title: task?.title || '',
      description: task?.description || '',
      taskType: task?.taskType,
      executionMode: task?.executionMode,
      priority: task?.priority,
    };

    return this.riskEngine.assess(assessmentInput);
  }

  /**
   * Check if approval is required for a task
   */
  async requiresApproval(taskId: string): Promise<boolean> {
    const task = await this.dependencies.store.getTaskById(taskId);
    if (!task) {
      return false;
    }

    const result = this.assessRisk(task);
    return result.approvalRequired;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getApproval(approvalId: string): Promise<ApprovalRecord | null> {
    const approvals = await this.dependencies.store.getApprovals();
    return approvals.find(a => a.id === approvalId) || null;
  }

  private async saveExtendedApproval(
    approvalId: string,
    fields: Partial<ExtendedApprovalRecord>
  ): Promise<void> {
    // Store extended fields in auxiliary JSON file
    const approvalsDir = path.join(
      process.env.AGENCY_MEMORY_DIR || '.ai',
      'approvals'
    );
    const fs = await import('node:fs/promises');
    await fs.mkdir(approvalsDir, { recursive: true });

    const filePath = path.join(approvalsDir, `${approvalId}.json`);
    try {
      const existing = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const updated = { ...existing, ...fields, id: approvalId };
      await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
    } catch {
      // File doesn't exist yet, create new
      await fs.writeFile(filePath, JSON.stringify({ ...fields, id: approvalId }, null, 2), 'utf8');
    }
  }

  private async loadExtendedApproval(
    approvalId: string
  ): Promise<Partial<ExtendedApprovalRecord>> {
    try {
      const fs = await import('node:fs/promises');
      const filePath = path.join(
        process.env.AGENCY_MEMORY_DIR || '.ai',
        'approvals',
        `${approvalId}.json`
      );
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async logAuditEvent(event: {
    entityType: 'approval';
    entityId: string;
    action: string;
    actor: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    reason?: string;
  }): Promise<void> {
    if (this.dependencies.auditLogger) {
      await this.dependencies.auditLogger.log(event);
    }
  }
}

/**
 * Factory function to create ApprovalServiceV2
 */
export function createApprovalServiceV2(
  dependencies: ApprovalServiceDependencies
): ApprovalServiceV2 {
  return new ApprovalServiceV2(dependencies);
}

/**
 * Legacy compatibility: evaluate approval requirement
 */
export function evaluateApprovalRequirement(input: {
  title: string;
  description: string;
}): { riskLevel: ApprovalRiskLevel; approvalRequired: boolean } {
  const { createDefaultRiskAssessmentEngine } = require('./risk-assessment');
  const engine = createDefaultRiskAssessmentEngine();

  const result = engine.assess({
    title: input.title,
    description: input.description,
  });

  return {
    riskLevel: result.riskLevel,
    approvalRequired: result.approvalRequired,
  };
}

/**
 * Legacy compatibility: create approval record
 */
export async function createApprovalRecord(
  taskId: string,
  store: Store
): Promise<ApprovalRecord> {
  const service = createApprovalServiceV2({ store });
  return service.createApproval({ taskId, requestedBy: 'system' });
}

/**
 * Legacy compatibility: approve approval
 */
export async function approveApproval(
  approvalId: string,
  store: Store,
  approver?: string
): Promise<ApprovalRecord> {
  const service = createApprovalServiceV2({ store });
  const result = await service.approve({
    approvalId,
    approver: approver || 'system',
    decision: 'approved',
  });
  if (!result) {
    throw new Error(`Approval not found: ${approvalId}`);
  }
  return result;
}

/**
 * Legacy compatibility: reject approval
 */
export async function rejectApproval(
  approvalId: string,
  store: Store,
  approver?: string
): Promise<ApprovalRecord> {
  const service = createApprovalServiceV2({ store });
  const result = await service.reject({
    approvalId,
    approver: approver || 'system',
    decision: 'rejected',
  });
  if (!result) {
    throw new Error(`Approval not found: ${approvalId}`);
  }
  return result;
}
