/**
 * Task Main Chain Integration Tests
 *
 * Tests for TaskMainChainService – the unified entry point for the
 * full task lifecycle: create → risk assess → approval → execute → writeback.
 *
 * Three paths are verified:
 * 1. Direct path:    low-risk task → create → route (skipExecution for speed)
 * 2. Approval path:  high-risk task → create → waiting_approval → approve/reject
 * 3. Workflow path:  serial/parallel executionMode → workflow classification
 *
 * Tests use skipExecution to avoid real runtime connections.
 * Execution layer is tested separately in task-execution-orchestrator tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ApprovalRecord,
  ExecutionRecord,
  TaskRecord,
  TaskAssignment,
  WorkflowPlan,
} from '../shared/task-types';
import {
  createTaskMainChainService,
  type MainChainResult,
} from '../orchestration/task-main-chain-service';

// ============================================================================
// Mock Store
// ============================================================================

class MockStore {
  private tasks = new Map<string, TaskRecord>();
  private approvals = new Map<string, ApprovalRecord>();
  private executions = new Map<string, ExecutionRecord>();
  private workflowPlans = new Map<string, WorkflowPlan>();
  private assignments = new Map<string, TaskAssignment>();

  async saveTask(task: TaskRecord): Promise<void> { this.tasks.set(task.id, { ...task }); }
  async getTaskById(id: string): Promise<TaskRecord | null> {
    const t = this.tasks.get(id); return t ? { ...t } : null;
  }
  async updateTask(id: string, u: (t: TaskRecord) => TaskRecord): Promise<TaskRecord | null> {
    const t = this.tasks.get(id); if (!t) return null;
    const updated = u({ ...t }); this.tasks.set(id, { ...updated }); return { ...updated };
  }
  async getTasks(): Promise<TaskRecord[]> { return Array.from(this.tasks.values()); }
  async saveApproval(a: ApprovalRecord): Promise<void> { this.approvals.set(a.id, { ...a }); }
  async getApprovals(): Promise<ApprovalRecord[]> { return Array.from(this.approvals.values()); }
  async getApprovalsByTaskId(tid: string): Promise<ApprovalRecord[]> {
    return Array.from(this.approvals.values()).filter(a => a.taskId === tid);
  }
  async updateApprovalStatus(id: string, status: ApprovalRecord['status'], actor?: string): Promise<ApprovalRecord | null> {
    const a = this.approvals.get(id); if (!a) return null;
    const updated = { ...a, status, approver: actor, approvedAt: new Date().toISOString() };
    this.approvals.set(id, { ...updated }); return { ...updated };
  }
  async saveExecution(e: ExecutionRecord): Promise<void> { this.executions.set(e.id, { ...e }); }
  async updateExecution(id: string, u: (e: ExecutionRecord) => ExecutionRecord): Promise<ExecutionRecord | null> {
    const e = this.executions.get(id); if (!e) return null;
    const updated = u({ ...e }); this.executions.set(id, { ...updated }); return { ...updated };
  }
  async getWorkflowPlanByTaskId(tid: string): Promise<WorkflowPlan | null> {
    for (const p of this.workflowPlans.values()) { if (p.taskId === tid) return { ...p }; } return null;
  }
  async saveWorkflowPlan(p: WorkflowPlan): Promise<void> { this.workflowPlans.set(p.id, { ...p }); }
  async updateWorkflowPlan(tid: string, u: (p: WorkflowPlan) => WorkflowPlan): Promise<WorkflowPlan | null> {
    for (const [id, p] of this.workflowPlans.entries()) {
      if (p.taskId === tid) { const updated = u({ ...p }); this.workflowPlans.set(id, { ...updated }); return { ...updated }; }
    } return null;
  }
  async getTaskAssignmentsByTaskId(tid: string): Promise<TaskAssignment[]> {
    return Array.from(this.assignments.values()).filter(a => a.taskId === tid);
  }
  async saveTaskAssignment(a: TaskAssignment): Promise<void> { this.assignments.set(a.id, { ...a }); }
  async updateTaskAssignment(id: string, u: (a: TaskAssignment) => TaskAssignment): Promise<TaskAssignment | null> {
    const a = this.assignments.get(id); if (!a) return null;
    const updated = u({ ...a }); this.assignments.set(id, { ...updated }); return { ...updated };
  }
  async getTaskAssignmentById(id: string): Promise<TaskAssignment | null> {
    const a = this.assignments.get(id); return a ? { ...a } : null;
  }
  async logAudit(_e: Record<string, unknown>): Promise<void> {}
  getTaskCount(): number { return this.tasks.size; }
  getApprovalCount(): number { return this.approvals.size; }
}

function createService() {
  const store = new MockStore();
  const service = createTaskMainChainService({
    store: store as unknown as import('../store').Store,
  });
  return { store, service };
}

// ============================================================================
// Direct Path Tests
// ============================================================================

test('MainChain direct: low-risk task creates and routes without execution', async () => {
  const { store, service } = createService();

  const result = await service.execute({
    title: 'Update README documentation',
    description: 'Add installation instructions to the README file',
    requestedBy: 'test-user',
    skipExecution: true,
  });

  assert.equal(result.path, 'direct');
  assert.equal(result.task.title, 'Update README documentation');
  assert.equal(result.task.requestedBy, 'test-user');
  assert.equal(result.task.approvalRequired, false);
  assert.ok(result.task.id);
  assert.equal(store.getTaskCount(), 1);
  assert.equal(result.execution, undefined, 'No execution when skipExecution=true');
});

test('MainChain direct: task with explicit type and priority', async () => {
  const { service } = createService();

  const result = await service.execute({
    title: 'Write unit tests',
    description: 'Add tests for the utility module',
    taskType: 'quality_assurance',
    priority: 'high',
    requestedBy: 'dev-user',
    skipExecution: true,
  });

  assert.equal(result.task.taskType, 'quality_assurance');
  assert.equal(result.task.priority, 'high');
  assert.ok(result.task.id);
});

// ============================================================================
// Approval Path Tests
// ============================================================================

test('MainChain approval: high-risk task waits for approval', async () => {
  const { store, service } = createService();

  const result = await service.execute({
    title: 'Delete production database',
    description: 'Remove all user data from production database permanently',
    requestedBy: 'admin-user',
    skipExecution: true,
  });

  assert.equal(result.path, 'approval');
  assert.equal(result.task.status, 'waiting_approval');
  assert.equal(result.task.approvalRequired, true);
  assert.equal(result.task.riskLevel, 'high');
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.equal(store.getApprovalCount(), 1);
  assert.equal(result.execution, undefined);
});

test('MainChain approval: approve resolves and routes task', async () => {
  const { store, service } = createService();

  // Create high-risk task
  const createResult = await service.execute({
    title: 'Drop all database tables',
    description: 'Remove all tables from the production database',
    requestedBy: 'admin-user',
    skipExecution: true,
  });

  assert.equal(createResult.path, 'approval');
  assert.equal(createResult.task.status, 'waiting_approval');
  assert.ok(createResult.approval);

  // Approve
  const approveResult = await service.resolveApproval({
    approvalId: createResult.approval!.id,
    decision: 'approved',
    approver: 'cto-user',
    reason: 'Approved for maintenance window',
    skipExecution: true,
  });

  assert.equal(approveResult.approval?.status, 'approved');
  assert.notEqual(approveResult.task.status, 'waiting_approval');
  assert.equal(approveResult.execution, undefined, 'No execution when skipExecution=true');
});

test('MainChain approval: reject cancels the task', async () => {
  const { store, service } = createService();

  const createResult = await service.execute({
    title: 'Drop production database immediately',
    description: 'Delete all production data without backup',
    requestedBy: 'admin-user',
    skipExecution: true,
  });

  assert.equal(createResult.task.status, 'waiting_approval');

  const rejectResult = await service.resolveApproval({
    approvalId: createResult.approval!.id,
    decision: 'rejected',
    approver: 'cto-user',
    reason: 'Too risky without backup',
  });

  assert.equal(rejectResult.approval?.status, 'rejected');
  assert.ok(
    rejectResult.task.status === 'cancelled' || rejectResult.task.status === 'failed',
    `Expected cancelled/failed, got: ${rejectResult.task.status}`
  );
  assert.equal(rejectResult.execution, undefined);
});

// ============================================================================
// Cancel Tests
// ============================================================================

test('MainChain cancel: cancels a waiting_approval task', async () => {
  const { service } = createService();

  const createResult = await service.execute({
    title: 'Delete production data permanently',
    description: 'Remove all production records permanently from database',
    requestedBy: 'admin-user',
    skipExecution: true,
  });

  assert.equal(createResult.task.status, 'waiting_approval');

  const cancelResult = await service.cancel(createResult.task.id, 'admin-user', 'No longer needed');
  assert.equal(cancelResult.status, 'cancelled');
});

test('MainChain cancel: throws for non-existent task', async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.cancel('non-existent-id', 'user', 'reason'),
    { message: /not found/i }
  );
});

// ============================================================================
// Workflow Path Tests
// ============================================================================

test('MainChain workflow: serial executionMode routes as workflow', async () => {
  const { service } = createService();

  const result = await service.execute({
    title: 'Multi-step feature',
    description: 'Implement feature with multiple steps',
    executionMode: 'serial',
    requestedBy: 'dev-user',
    skipExecution: true,
  });

  assert.equal(result.path, 'workflow');
  assert.equal(result.task.executionMode, 'serial');
});

test('MainChain workflow: parallel executionMode routes as workflow', async () => {
  const { service } = createService();

  const result = await service.execute({
    title: 'Parallel code review',
    description: 'Review multiple files in parallel',
    executionMode: 'parallel',
    requestedBy: 'dev-user',
    skipExecution: true,
  });

  assert.equal(result.path, 'workflow');
  assert.equal(result.task.executionMode, 'parallel');
});

// ============================================================================
// Unified Semantics
// ============================================================================

test('MainChain: three paths produce correct path identifiers', async () => {
  const { service } = createService();

  const direct = await service.execute({ title: 'Doc update', description: 'Simple doc change', requestedBy: 'u1', skipExecution: true });
  assert.equal(direct.path, 'direct');

  const workflow = await service.execute({ title: 'Feature', description: 'Multi-step', executionMode: 'serial', requestedBy: 'u2', skipExecution: true });
  assert.equal(workflow.path, 'workflow');

  const approval = await service.execute({ title: 'Drop prod DB', description: 'Remove all production data permanently', requestedBy: 'u3', skipExecution: true });
  assert.equal(approval.path, 'approval');
});

test('MainChain: all paths produce consistent task record shape', async () => {
  const { service } = createService();

  const direct = await service.execute({ title: 'Low risk', description: 'Simple task', requestedBy: 'u1', skipExecution: true });
  const approval = await service.execute({ title: 'Delete all prod data permanently', description: 'Production data removal', requestedBy: 'u2', skipExecution: true });

  const requiredFields = ['id', 'title', 'description', 'status', 'riskLevel', 'requestedBy', 'createdAt', 'updatedAt'] as const;
  for (const field of requiredFields) {
    assert.ok(field in direct.task, `Direct task missing: ${field}`);
    assert.ok(field in approval.task, `Approval task missing: ${field}`);
  }
});
