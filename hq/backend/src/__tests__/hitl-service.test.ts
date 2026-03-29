/**
 * HITL Service Tests
 *
 * Tests for the suspend/resume lifecycle:
 *   running → suspended → [human feedback] → running
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { TaskRecord } from '../shared/task-types';
import { TaskStateMachine } from '../orchestration/task-state-machine';
import { HitlService } from '../orchestration/hitl-service';
import type { SuspendReason } from '../shared/hitl-types';

// ============================================================================
// Mock Store
// ============================================================================

class MockStore {
  private tasks = new Map<string, TaskRecord>();

  async saveTask(task: TaskRecord): Promise<void> { this.tasks.set(task.id, { ...task }); }
  async getTaskById(id: string): Promise<TaskRecord | null> {
    const t = this.tasks.get(id); return t ? { ...t } : null;
  }
  async updateTask(id: string, updater: (t: TaskRecord) => TaskRecord): Promise<TaskRecord | null> {
    const t = this.tasks.get(id); if (!t) return null;
    const updated = updater({ ...t }); this.tasks.set(id, { ...updated }); return { ...updated };
  }
  async getTasks(): Promise<TaskRecord[]> { return Array.from(this.tasks.values()); }
  async logAudit(_e: Record<string, unknown>): Promise<void> {}
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Test task',
    description: 'Test task description',
    taskType: 'general',
    priority: 'medium',
    status: 'running',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: '2026-03-29T00:00:00.000Z',
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect'],
    routeReason: 'matched by default',
    routingStatus: 'matched',
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
    ...overrides,
  };
}

function createHitlService() {
  const store = new MockStore();
  const stateMachine = new TaskStateMachine(
    {
      list: () => store.getTasks(),
      getById: (id: string) => store.getTaskById(id),
      save: (task: TaskRecord) => store.saveTask(task),
      update: (id: string, u: (t: TaskRecord) => TaskRecord) => store.updateTask(id, u),
    },
    null
  );
  const service = new HitlService({
    store: store as unknown as import('../store').Store,
    stateMachine,
  });
  return { store, service };
}

// ============================================================================
// Suspend Tests
// ============================================================================

test('HitlService.suspend: transitions running → suspended', async () => {
  const { store, service } = createHitlService();

  // Create a running task
  const task = makeTask({ status: 'running' });
  await store.saveTask(task);

  const result = await service.suspend(
    'task-1',
    'missing_information',
    'Need more context to proceed',
    'system'
  );

  assert.equal(result.task.status, 'suspended');
  assert.ok(result.suspendPayload);
  assert.equal(result.suspendPayload!.reason, 'missing_information');
  assert.equal(result.suspendPayload!.suspendedBy, 'system');
});

test('HitlService.suspend: throws if task not found', async () => {
  const { service } = createHitlService();
  await assert.rejects(
    () => service.suspend('nonexistent', 'missing_information', 'msg', 'system'),
    { message: /not found/i }
  );
});

test('HitlService.suspend: throws if task not running', async () => {
  const { store, service } = createHitlService();
  const task = makeTask({ status: 'created' });
  await store.saveTask(task);

  await assert.rejects(
    () => service.suspend('task-1', 'missing_information', 'msg', 'system'),
    { message: /not running/i }
  );
});

// ============================================================================
// Resume Tests
// ============================================================================

test('HitlService.resume: transitions suspended → running with feedback', async () => {
  const { store, service } = createHitlService();

  // Create a suspended task
  const task = makeTask({ status: 'suspended' });
  await store.saveTask(task);

  const result = await service.resume(
    'task-1',
    {
      feedbackText: 'Here is the additional information you requested',
      feedbackType: 'text',
      responder: 'human-operator',
      respondedAt: new Date().toISOString(),
    },
    'human-operator'
  );

  assert.equal(result.task.status, 'running');
  assert.ok(result.feedback);
  assert.equal(result.feedback!.feedbackText, 'Here is the additional information you requested');
  assert.equal(result.feedback!.responder, 'human-operator');
});

test('HitlService.resume: throws if task not suspended', async () => {
  const { store, service } = createHitlService();
  const task = makeTask({ status: 'running' });
  await store.saveTask(task);

  await assert.rejects(
    () => service.resume('task-1', {
      feedbackText: 'info',
      feedbackType: 'text',
      responder: 'user',
      respondedAt: new Date().toISOString(),
    }, 'user'),
    { message: /not suspended/i }
  );
});

// ============================================================================
// Full cycle test
// ============================================================================

test('HitlService: full suspend → feedback → resume cycle', async () => {
  const { store, service } = createHitlService();

  // Start with running task
  const task = makeTask({ status: 'running' });
  await store.saveTask(task);

  // Suspend
  const suspended = await service.suspend(
    'task-1',
    'approval_required',
    'Needs approval before proceeding',
    'agent'
  );
  assert.equal(suspended.task.status, 'suspended');

  // Resume with human feedback
  const resumed = await service.resume(
    'task-1',
    {
      feedbackText: 'Approved to proceed',
      feedbackType: 'approval',
      responder: 'manager',
      respondedAt: new Date().toISOString(),
    },
    'manager'
  );
  assert.equal(resumed.task.status, 'running');
});

test('HitlService: all three suspend reasons work', async () => {
  const reasons: SuspendReason[] = ['missing_information', 'approval_required', 'draft_review_required'];

  for (const reason of reasons) {
    const { store, service } = createHitlService();
    const task = makeTask({ id: `task-${reason}`, status: 'running' });
    await store.saveTask(task);

    const result = await service.suspend(`task-${reason}`, reason, `Need ${reason}`, 'system');
    assert.equal(result.task.status, 'suspended');
    assert.equal(result.suspendPayload!.reason, reason);
  }
});
