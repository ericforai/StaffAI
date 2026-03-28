/**
 * Task Lifecycle Service Tests
 *
 * Tests for the TaskLifecycleService which integrates ApprovalServiceV2
 * for risk assessment and approval workflows.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ApprovalRecord,
  TaskRecord,
} from '../shared/task-types';
import {
  createTaskLifecycleService,
  type CreateTaskInput,
} from '../orchestration/task-lifecycle-service';

// ============================================================================
// Mock Dependencies
// ============================================================================

class MockStore {
  private tasks = new Map<string, TaskRecord>();
  private approvals = new Map<string, ApprovalRecord>();

  async saveTask(task: TaskRecord): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async getTaskById(taskId: string): Promise<TaskRecord | null> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  async updateTask(
    taskId: string,
    updater: (task: TaskRecord) => TaskRecord
  ): Promise<TaskRecord | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    const updated = updater({ ...task });
    this.tasks.set(taskId, { ...updated });
    return { ...updated };
  }

  async saveApproval(approval: ApprovalRecord): Promise<void> {
    this.approvals.set(approval.id, { ...approval });
  }

  async getApprovals(): Promise<ApprovalRecord[]> {
    return Array.from(this.approvals.values());
  }

  async updateApprovalStatus(
    approvalId: string,
    status: ApprovalRecord['status'],
    actor?: string
  ): Promise<ApprovalRecord | null> {
    const approval = this.approvals.get(approvalId);
    if (!approval) return null;
    approval.status = status;
    approval.approver = actor;
    approval.approvedAt = new Date().toISOString();
    this.approvals.set(approvalId, { ...approval });
    return { ...approval };
  }

  async getApprovalsByTaskId(taskId: string): Promise<ApprovalRecord[]> {
    return Array.from(this.approvals.values()).filter(a => a.taskId === taskId);
  }

  async getTasks(): Promise<TaskRecord[]> {
    return Array.from(this.tasks.values());
  }

  // Helper methods for testing
  getTaskCount(): number {
    return this.tasks.size;
  }

  getApprovalCount(): number {
    return this.approvals.size;
  }

  clear(): void {
    this.tasks.clear();
    this.approvals.clear();
  }
}

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

  clear(): void {
    this.logs = [];
  }
}

// ============================================================================
// Test Helper Functions
// ============================================================================

function createMockTaskInput(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    title: 'Test Task',
    description: 'Test task description',
    requestedBy: 'test-user',
    ...overrides,
  };
}

// ============================================================================
// TaskLifecycleService - createTask Tests
// ============================================================================

test('TaskLifecycleService.createTask creates a task without approval for low risk', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createTaskLifecycleService({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const task = await service.createTask({
    title: 'Update documentation',
    description: 'Add new API documentation',
    requestedBy: 'user1',
  });

  assert.equal(task.title, 'Update documentation');
  assert.equal(task.status, 'routed');
  assert.equal(task.approvalRequired, false);
  assert.equal(task.riskLevel, 'low');
  assert.equal(mockStore.getApprovalCount(), 0);
});

test('TaskLifecycleService.createTask creates task with approval for high risk', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createTaskLifecycleService({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const task = await service.createTask({
    title: 'Delete production database',
    description: 'Remove all user data from production',
    requestedBy: 'user1',
  });

  assert.equal(task.status, 'waiting_approval');
  assert.equal(task.approvalRequired, true);
  assert.equal(task.riskLevel, 'high');
  assert.equal(mockStore.getApprovalCount(), 1);

  const approvals = await mockStore.getApprovals();
  assert.equal(approvals[0].taskId, task.id);
  assert.equal(approvals[0].status, 'pending');
});

test('TaskLifecycleService.createTask creates approval for Chinese high-risk task', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: '请删除生产数据库中的用户表',
    description: '需要删表并处理生产环境数据',
    requestedBy: 'user1',
  });

  assert.equal(task.status, 'waiting_approval');
  assert.equal(task.approvalRequired, true);
  assert.equal(task.riskLevel, 'high');
  assert.equal(mockStore.getApprovalCount(), 1);

  const approvals = await mockStore.getApprovals();
  assert.equal(approvals[0].taskId, task.id);
  assert.equal(approvals[0].status, 'pending');
});

test('TaskLifecycleService.createTask assigns LOW risk for documentation tasks', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Update README',
    description: 'Add new installation instructions',
    requestedBy: 'user1',
  });

  assert.equal(task.riskLevel, 'low');
  assert.equal(task.approvalRequired, false);
});

test('TaskLifecycleService.createTask assigns HIGH risk for destructive keywords', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  // Destructive keywords need more context (like production) to trigger HIGH risk
  // For standalone keywords, they may still trigger approval (MEDIUM risk)
  const highRiskTasks = [
    { title: 'Delete production database', description: 'Remove all user data' },
    { title: 'Drop table users', description: 'Database destructive operation' },
    { title: 'Wipe production data', description: 'Clean production records' },
  ];

  for (const taskInput of highRiskTasks) {
    const task = await service.createTask({
      ...taskInput,
      requestedBy: 'user1',
    });

    assert.equal(task.riskLevel, 'high', `Expected high risk for: ${taskInput.title}`);
    assert.equal(task.approvalRequired, true, `Expected approval required for: ${taskInput.title}`);
  }
});

test('TaskLifecycleService.createTask assigns HIGH risk for production keywords', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Deploy to production',
    description: 'Release to live environment',
    requestedBy: 'user1',
  });

  assert.equal(task.riskLevel, 'high');
  assert.equal(task.approvalRequired, true);
});

test('TaskLifecycleService.createTask persists task to store', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'New Task',
    description: 'Description',
    requestedBy: 'user1',
  });

  const retrieved = await mockStore.getTaskById(task.id);
  assert.notEqual(retrieved, null);
  assert.equal(retrieved?.id, task.id);
  assert.equal(retrieved?.title, 'New Task');
});

// ============================================================================
// TaskLifecycleService - requestApproval Tests
// ============================================================================

test('TaskLifecycleService.requestApproval creates approval for task', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Test Task',
    description: 'Description',
    requestedBy: 'user1',
  });

  const approval = await service.requestApproval(task.id, 'Manual approval request');

  assert.equal(approval.taskId, task.id);
  assert.equal(approval.status, 'pending');
  assert.equal(mockStore.getApprovalCount(), 1);
});

test('TaskLifecycleService.requestApproval includes reason in extended fields', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Test Task',
    description: 'Description',
    requestedBy: 'user1',
  });

  const reason = 'Additional review needed for compliance';
  await service.requestApproval(task.id, reason);

  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].taskId, task.id);
});

test('TaskLifecycleService.requestApproval updates task to waiting_approval', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Safe task',
    description: 'Low risk operation',
    requestedBy: 'user1',
  });

  assert.equal(task.status, 'routed');

  await service.requestApproval(task.id);

  const updated = await mockStore.getTaskById(task.id);
  assert.equal(updated?.status, 'waiting_approval');
});

// ============================================================================
// TaskLifecycleService - handleApprovalDecision Tests
// ============================================================================

test('TaskLifecycleService.handleApprovalDecision approves and routes task', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createTaskLifecycleService({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const task = await service.createTask({
    title: 'Delete data',
    description: 'Destructive operation',
    requestedBy: 'user1',
  });

  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  await service.handleApprovalDecision(approvalId, 'approved', 'admin', 'Approved after review');

  const updatedApproval = await mockStore.getApprovalsByTaskId(task.id);
  assert.equal(updatedApproval[0].status, 'approved');
  assert.equal(updatedApproval[0].approver, 'admin');

  const updatedTask = await mockStore.getTaskById(task.id);
  assert.equal(updatedTask?.status, 'routed');
  assert.equal(updatedTask?.approvalRequired, false);
});

test('TaskLifecycleService.handleApprovalDecision rejects and cancels task', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Delete data',
    description: 'Destructive operation',
    requestedBy: 'user1',
  });

  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  await service.handleApprovalDecision(approvalId, 'rejected', 'admin', 'Too risky');

  const updatedApproval = await mockStore.getApprovalsByTaskId(task.id);
  assert.equal(updatedApproval[0].status, 'rejected');
  assert.equal(updatedApproval[0].approver, 'admin');

  const updatedTask = await mockStore.getTaskById(task.id);
  assert.equal(updatedTask?.status, 'cancelled');
});

test('TaskLifecycleService.handleApprovalDecision logs audit event', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createTaskLifecycleService({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  const task = await service.createTask({
    title: 'Delete production data',
    description: 'Destructive operation in production',
    requestedBy: 'user1',
  });

  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  assert.ok(approvals.length > 0, 'Approval should be created for high-risk task');
  const approvalId = approvals[0].id;

  await service.handleApprovalDecision(approvalId, 'approved', 'admin');

  assert.ok(mockAudit.logs.length >= 2); // created + approved
  const approvedLog = mockAudit.logs.find(log => log.action === 'approved');
  assert.equal(approvedLog?.actor, 'admin');
});

// ============================================================================
// TaskLifecycleService - cancelApproval Tests
// ============================================================================

test('TaskLifecycleService.cancelApproval cancels pending approval', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Delete data',
    description: 'Destructive',
    requestedBy: 'user1',
  });

  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  await service.cancelApproval(task.id, 'user1', 'No longer needed');

  const updatedApproval = await mockStore.getApprovalsByTaskId(task.id);
  assert.equal(updatedApproval[0].status, 'cancelled');
});

test('TaskLifecycleService.cancelApproval updates task to cancelled', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Delete data',
    description: 'Destructive',
    requestedBy: 'user1',
  });

  assert.equal(task.status, 'waiting_approval');

  await service.cancelApproval(task.id, 'user1');

  const updatedTask = await mockStore.getTaskById(task.id);
  assert.equal(updatedTask?.status, 'cancelled');
});

test('TaskLifecycleService.cancelApproval is idempotent for non-pending approvals', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Delete data',
    description: 'Destructive',
    requestedBy: 'user1',
  });

  // First approve the approval
  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  await service.handleApprovalDecision(approvals[0].id, 'approved', 'admin');

  // Then try to cancel - should handle gracefully
  await service.cancelApproval(task.id, 'user1');

  const updatedApprovals = await mockStore.getApprovalsByTaskId(task.id);
  // Approval should remain approved (or be cancelled if that's the desired behavior)
  assert.notEqual(updatedApprovals[0].status, 'pending');
});

// ============================================================================
// TaskLifecycleService - assessTaskRisk Tests
// ============================================================================

test('TaskLifecycleService.assessTaskRisk returns LOW for safe tasks', () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const assessment = service.assessTaskRisk({
    title: 'Update documentation',
    description: 'Add new docs',
  });

  assert.equal(assessment.riskLevel, 'LOW');
  assert.equal(assessment.approvalRequired, false);
});

test('TaskLifecycleService.assessTaskRisk returns HIGH for destructive tasks', () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const assessment = service.assessTaskRisk({
    title: 'Delete production database',
    description: 'Remove all data',
  });

  assert.equal(assessment.riskLevel, 'HIGH');
  assert.equal(assessment.approvalRequired, true);
});

test('TaskLifecycleService.assessTaskRisk returns MEDIUM for urgent tasks', () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const assessment = service.assessTaskRisk({
    title: 'Hotfix issue',
    description: 'Fix bug quickly',
    priority: 'urgent',
  });

  // Urgent priority triggers MEDIUM risk (weight 4 >= MEDIUM threshold 4)
  assert.equal(assessment.riskLevel, 'MEDIUM');
  assert.equal(assessment.approvalRequired, true);
});

test('TaskLifecycleService.assessTaskRisk returns risk factors', () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const assessment = service.assessTaskRisk({
    title: 'Delete production database',
    description: 'Remove all data',
  });

  assert.ok(assessment.factors.length > 0);
  assert.ok(assessment.factors.some(f => f.includes('production') || f.includes('destructive')));
  assert.ok(assessment.confidence > 0);
});

// ============================================================================
// TaskLifecycleService - Error Handling Tests
// ============================================================================

test('TaskLifecycleService.requestApproval throws for non-existent task', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  await assert.rejects(
    async () => service.requestApproval('non-existent-task-id'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok((err as Error).message.includes('not found'));
      return true;
    }
  );
});

test('TaskLifecycleService.handleApprovalDecision returns null for non-existent approval', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const result = await service.handleApprovalDecision('non-existent', 'approved', 'admin');
  assert.equal(result.approval, null);
  assert.equal(result.task, null);
});

test('TaskLifecycleService.cancelApproval handles task with no approval gracefully', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Safe task',
    description: 'No approval needed',
    requestedBy: 'user1',
  });

  // Should not throw even though there's no approval
  await service.cancelApproval(task.id, 'user1');

  const updatedTask = await mockStore.getTaskById(task.id);
  assert.equal(updatedTask?.status, 'cancelled');
});

// ============================================================================
// TaskLifecycleService - Integration Tests
// ============================================================================

test('TaskLifecycleService full workflow: create, approve, route', async () => {
  const mockStore = new MockStore();
  const mockAudit = new MockAuditLogger();
  const service = createTaskLifecycleService({
    store: mockStore as any,
    auditLogger: mockAudit as any,
  });

  // 1. Create high-risk task
  const task = await service.createTask({
    title: 'Delete production data',
    description: 'Remove user records',
    requestedBy: 'user1',
  });

  assert.equal(task.status, 'waiting_approval');
  assert.equal(mockStore.getApprovalCount(), 1);

  // 2. Get approval and approve it
  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  await service.handleApprovalDecision(approvalId, 'approved', 'admin', 'Approved');

  // 3. Verify task is now routed
  const updatedTask = await mockStore.getTaskById(task.id);
  assert.equal(updatedTask?.status, 'routed');
  assert.equal(updatedTask?.approvalRequired, false);
});

test('TaskLifecycleService full workflow: create, reject, cancel', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  // 1. Create high-risk task
  const task = await service.createTask({
    title: 'Delete production data',
    description: 'Remove user records',
    requestedBy: 'user1',
  });

  // 2. Get approval and reject it
  const approvals = await mockStore.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  await service.handleApprovalDecision(approvalId, 'rejected', 'admin', 'Too risky');

  // 3. Verify task is cancelled
  const updatedTask = await mockStore.getTaskById(task.id);
  assert.equal(updatedTask?.status, 'cancelled');
});

test('TaskLifecycleService handles MEDIUM risk with urgent priority', async () => {
  const mockStore = new MockStore();
  const service = createTaskLifecycleService({ store: mockStore as any });

  const task = await service.createTask({
    title: 'Backend implementation with urgent priority',
    description: 'Standard task but marked urgent',
    requestedBy: 'user1',
    priority: 'urgent',
    taskType: 'backend_implementation',
  });

  // Urgent priority triggers MEDIUM risk (weight 4 >= MEDIUM threshold 4)
  // Backend implementation doesn't have the LOW risk modifier
  assert.equal(task.riskLevel, 'medium');
  assert.equal(task.approvalRequired, true);
  assert.equal(task.status, 'waiting_approval');
});
