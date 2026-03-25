/**
 * Approval Service v2 Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'os';
import path from 'path';
import {
  ApprovalServiceV2,
  ApprovalNotFoundError,
  InvalidApprovalStateError,
  createApprovalServiceV2,
  evaluateApprovalRequirement,
} from '../governance/approval-service-v2';
import type { ApprovalRecord, ApprovalRiskLevel } from '../shared/task-types';

// Mock Store
class MockStore {
  private approvals = new Map<string, ApprovalRecord>();
  private tasks = new Map<string, { title: string; description: string; taskType?: string; executionMode?: string; priority?: string; riskLevel?: string; approvalRequired?: boolean }>();

  async saveApproval(approval: ApprovalRecord): Promise<void> {
    this.approvals.set(approval.id, approval);
  }

  async updateApprovalStatus(
    approvalId: string,
    status: 'approved' | 'rejected' | 'cancelled',
    actor?: string
  ): Promise<ApprovalRecord> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    approval.status = status;
    approval.approver = actor;
    approval.approvedAt = new Date().toISOString();
    approval.resolvedAt = new Date().toISOString();
    return { ...approval };
  }

  async getApprovals(): Promise<ApprovalRecord[]> {
    return Array.from(this.approvals.values());
  }

  async getTaskById(id: string): Promise<{ title: string; description: string; taskType?: string; executionMode?: string; priority?: string; riskLevel?: string; approvalRequired?: boolean } | undefined> {
    return Promise.resolve(this.tasks.get(id));
  }

  // Add task for testing
  addTask(id: string, task: { title: string; description: string; taskType?: string; executionMode?: string; priority?: string; riskLevel?: string; approvalRequired?: boolean }) {
    this.tasks.set(id, task);
  }
}

// Mock Audit Logger
class MockAuditLogger {
  logs: Array<{ entityType: string; entityId: string; action: string; actor: string }> = [];

  async log(event: {
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    reason?: string;
  }): Promise<void> {
    this.logs.push({
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      actor: event.actor,
    });
  }
}

test.before(() => {
  // Setup code if needed
});

// ============================================================================
// evaluateApprovalRequirement Tests
// ============================================================================

test('evaluateApprovalRequirement returns LOW risk for safe operations', () => {
  const result = evaluateApprovalRequirement({
    title: 'Update documentation',
    description: 'Add new API documentation',
  });

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
});

test('evaluateApprovalRequirement returns HIGH risk for destructive operations', () => {
  const result = evaluateApprovalRequirement({
    title: 'Delete production database',
    description: 'Remove all user data',
  });

  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.approvalRequired, true);
});

// ============================================================================
// ApprovalServiceV2 - Create Approval
// ============================================================================

test('ApprovalServiceV2.createApproval creates pending approval', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createApprovalServiceV2({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const approval = await service.createApproval({
    taskId: 'task-1',
    taskTitle: 'Test Task',
    requestedBy: 'user1',
  });

  assert.equal(approval.status, 'pending');
  assert.equal(approval.taskId, 'task-1');
  assert.equal(mockAudit.logs.length, 1);
  assert.equal(mockAudit.logs[0].action, 'created');
});

test('ApprovalServiceV2.createApproval assesses risk level', async () => {
  const mockStore = new MockStore();
  mockStore.addTask('task-1', {
    title: 'Delete production data',
    description: 'Remove production records',
  });

  const service = createApprovalServiceV2({ store: mockStore as any });
  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  const extended = await service.getExtendedApproval(approval.id);
  assert.equal(extended?.riskLevel, 'HIGH');
});

test('ApprovalServiceV2.createApproval with LOW risk task', async () => {
  const mockStore = new MockStore();
  mockStore.addTask('task-1', {
    title: 'Update documentation',
    description: 'Add new docs',
  });

  const service = createApprovalServiceV2({ store: mockStore as any });
  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  const extended = await service.getExtendedApproval(approval.id);
  assert.equal(extended?.riskLevel, 'LOW');
});

// ============================================================================
// ApprovalServiceV2 - Approve/Reject
// ============================================================================

test('ApprovalServiceV2.approve updates approval status', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createApprovalServiceV2({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  const updated = await service.approve({
    approvalId: approval.id,
    approver: 'admin',
    decision: 'approved',
    reason: 'Looks good',
  });

  assert.equal(updated?.status, 'approved');
  assert.equal(updated?.approver, 'admin');
  assert.equal(mockAudit.logs.length, 2); // created + approved
});

test('ApprovalServiceV2.reject updates approval status', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createApprovalServiceV2({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  const updated = await service.reject({
    approvalId: approval.id,
    approver: 'admin',
    decision: 'rejected',
    reason: 'Too risky',
  });

  assert.equal(updated?.status, 'rejected');
});

test('ApprovalServiceV2.cancel cancels pending approval', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createApprovalServiceV2({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  const updated = await service.cancel({
    approvalId: approval.id,
    actor: 'user1',
    reason: 'No longer needed',
  });

  assert.equal(updated?.status, 'cancelled');
  assert.equal(mockAudit.logs[1].action, 'cancelled');
});

test('ApprovalServiceV2.cancel throws on non-pending approval', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createApprovalServiceV2({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  await service.approve({
    approvalId: approval.id,
    approver: 'admin',
    decision: 'approved',
  });

  await assert.rejects(
    async () => service.cancel({
      approvalId: approval.id,
      actor: 'user1',
    }),
    (err: unknown) => {
      assert.ok(err instanceof InvalidApprovalStateError);
      assert.equal((err as InvalidApprovalStateError).currentStatus, 'approved');
      assert.equal((err as InvalidApprovalStateError).requiredStatus, 'pending');
      return true;
    }
  );
});

// ============================================================================
// ApprovalServiceV2 - Queries
// ============================================================================

test('ApprovalServiceV2.getPendingApprovals returns only pending', async () => {
  const mockStore = new MockStore();
  const service = createApprovalServiceV2({ store: mockStore as any });

  await service.createApproval({ taskId: 'task-1', requestedBy: 'user1' });
  await service.createApproval({ taskId: 'task-2', requestedBy: 'user2' });

  const approved = await service.createApproval({ taskId: 'task-3', requestedBy: 'user3' });
  await service.approve({ approvalId: approved.id, approver: 'admin', decision: 'approved' });

  const pending = await service.getPendingApprovals();

  assert.equal(pending.length, 2);
  assert.equal(pending.every((a: ApprovalRecord) => a.status === 'pending'), true);
});

test('ApprovalServiceV2.getApprovalsByTaskId returns task approvals', async () => {
  const mockStore = new MockStore();
  const service = createApprovalServiceV2({ store: mockStore as any });

  await service.createApproval({ taskId: 'task-1', requestedBy: 'user1' });
  await service.createApproval({ taskId: 'task-1', requestedBy: 'user2' });
  await service.createApproval({ taskId: 'task-2', requestedBy: 'user3' });

  const task1Approvals = await service.getApprovalsByTaskId('task-1');

  assert.equal(task1Approvals.length, 2);
  assert.equal(task1Approvals.every((a: ApprovalRecord) => a.taskId === 'task-1'), true);
});

// ============================================================================
// ApprovalServiceV2 - Risk Assessment
// ============================================================================

test('ApprovalServiceV2.assessRisk returns risk level', async () => {
  const mockStore = new MockStore();
  mockStore.addTask('safe-task', {
    title: 'Safe task',
    description: 'Just a query',
  });

  const service = createApprovalServiceV2({ store: mockStore as any });
  const result = service.assessRisk({ taskId: 'safe-task', requestedBy: 'user1' });

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
});

test('ApprovalServiceV2.requiresApproval checks task risk', async () => {
  const mockStore = new MockStore();
  mockStore.addTask('risky-task', {
    title: 'Delete production database',
    description: 'Destructive operation',
  });

  const service = createApprovalServiceV2({ store: mockStore as any });
  const required = await service.requiresApproval('risky-task');

  assert.equal(required, true);
});

// ============================================================================
// Error Handling
// ============================================================================

test('ApprovalServiceV2.approve returns null for non-existent approval', async () => {
  const mockStore = new MockStore();
  const service = createApprovalServiceV2({ store: mockStore as any });

  const result = await service.approve({
    approvalId: 'non-existent',
    approver: 'admin',
    decision: 'approved',
  });

  assert.equal(result, null);
});

test('ApprovalServiceV2.cancel throws for non-existent approval', async () => {
  const mockStore = new MockStore();
  const service = createApprovalServiceV2({ store: mockStore as any });

  await assert.rejects(
    async () => service.cancel({
      approvalId: 'non-existent',
      actor: 'user1',
    }),
    (err: unknown) => {
      assert.ok(err instanceof ApprovalNotFoundError);
      assert.equal((err as ApprovalNotFoundError).approvalId, 'non-existent');
      return true;
    }
  );
});

// ============================================================================
// Extended Approval Fields
// ============================================================================

test('ApprovalServiceV2.getExtendedApproval includes all fields', async () => {
  const mockStore = new MockStore();
  const service = createApprovalServiceV2({ store: mockStore as any });

  const approval = await service.createApproval({
    taskId: 'task-1',
    taskTitle: 'Important Task',
    requestedBy: 'user1',
  });

  const extended = await service.getExtendedApproval(approval.id);

  assert.notEqual(extended, null);
  assert.equal(extended?.taskId, 'task-1');
  assert.equal(extended?.taskTitle, 'Important Task');
  assert.notEqual(extended?.riskLevel, undefined);
});

test('ApprovalServiceV2.approve stores reason in extended fields', async () => {
  const mockStore = new MockStore();
  const service = createApprovalServiceV2({ store: mockStore as any });

  const approval = await service.createApproval({
    taskId: 'task-1',
    requestedBy: 'user1',
  });

  await service.approve({
    approvalId: approval.id,
    approver: 'admin',
    decision: 'approved',
    reason: 'Approved after review',
  });

  const extended = await service.getExtendedApproval(approval.id);
  assert.equal(extended?.reason, 'Approved after review');
  assert.equal(extended?.approver, 'admin');
  assert.notEqual(extended?.approvedAt, undefined);
});
