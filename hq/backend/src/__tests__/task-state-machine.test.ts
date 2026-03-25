import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskStateMachine,
  createTaskStateMachine,
  TASK_STATE_TRANSITIONS,
  type TaskEvent,
  type TaskTransitionResult,
} from '../orchestration/task-state-machine';
import type { TaskRecord } from '../shared/task-types';
import type { TaskRepository } from '../persistence/file-repositories';
import type { AuditLogger } from '../governance/audit-logger';

// Mock implementations
function createMockTaskRepository(tasks: TaskRecord[] = []): TaskRepository {
  const taskMap = new Map<string, TaskRecord>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  return {
    async list() {
      return Array.from(taskMap.values());
    },
    async getById(taskId) {
      return taskMap.get(taskId) || null;
    },
    async save(task) {
      taskMap.set(task.id, task);
    },
    async update(taskId, updater) {
      const existing = taskMap.get(taskId);
      if (!existing) {
        return null;
      }
      const updated = updater(existing);
      taskMap.set(taskId, updated);
      return updated;
    },
  };
}

function createMockAuditLogger(): AuditLogger {
  const logs: Array<{
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    reason?: string;
  }> = [];

  return {
    async log(event: {
      entityType: string;
      entityId: string;
      action: string;
      actor: string;
      previousState?: Record<string, unknown>;
      newState?: Record<string, unknown>;
      reason?: string;
    }) {
      logs.push(event);
      return {
        id: 'log-' + Math.random(),
        timestamp: new Date().toISOString(),
        ...event,
      };
    },
    async getAuditTrail() {
      return [];
    },
    async getAuditLogsByType() {
      return [];
    },
    async getAuditLogsByActor() {
      return [];
    },
    async getAuditLogsByTimeRange() {
      return [];
    },
    async query() {
      return logs.map((log) => ({
        id: 'log-1',
        timestamp: new Date().toISOString(),
        ...log,
      }));
    },
    async getById() {
      return null;
    },
  } as unknown as AuditLogger;
}

function createTestTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test description',
    taskType: 'general',
    priority: 'medium',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'user-1',
    requestedAt: new Date().toISOString(),
    recommendedAgentRole: 'developer',
    candidateAgentRoles: ['developer'],
    routeReason: 'Matched',
    routingStatus: 'matched',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('TASK_STATE_TRANSITIONS defines valid state transitions', () => {
  assert.ok(TASK_STATE_TRANSITIONS.created);
  assert.ok(Array.isArray(TASK_STATE_TRANSITIONS.created));
  assert.ok(TASK_STATE_TRANSITIONS.created.includes('route'));
  assert.ok(TASK_STATE_TRANSITIONS.created.includes('cancel'));
});

test('TaskStateMachine.canTransition checks valid transitions', async () => {
  const repository = createMockTaskRepository([createTestTask({ status: 'created' })]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  assert.equal(await stateMachine.canTransition('task-1', 'routed'), true);
  assert.equal(await stateMachine.canTransition('task-1', 'running'), true);
  assert.equal(await stateMachine.canTransition('task-1', 'waiting_approval'), true);
  assert.equal(await stateMachine.canTransition('task-1', 'cancelled'), true);
  assert.equal(await stateMachine.canTransition('task-1', 'completed'), false);
  assert.equal(await stateMachine.canTransition('task-1', 'failed'), false);
});

test('TaskStateMachine.canTransition returns false for non-existent task', async () => {
  const repository = createMockTaskRepository([]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  assert.equal(await stateMachine.canTransition('non-existent', 'routed'), false);
});

test('TaskStateMachine.transition performs valid state change', async () => {
  const task = createTestTask({ status: 'created' });
  const repository = createMockTaskRepository([task]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  const result = await stateMachine.transition('task-1', 'route', 'user-1');

  assert.equal(result.success, true);
  assert.equal(result.previousStatus, 'created');
  assert.equal(result.newStatus, 'routed');
  assert.equal(result.taskId, 'task-1');
  assert.equal(result.error, undefined);

  const updated = await repository.getById('task-1');
  assert.equal(updated?.status, 'routed');
});

test('TaskStateMachine.transition fails for invalid transition', async () => {
  const task = createTestTask({ status: 'created' });
  const repository = createMockTaskRepository([task]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  const result = await stateMachine.transition('task-1', 'complete_execution', 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.previousStatus, 'created');
  assert.equal(result.newStatus, 'created');
  assert.equal(result.taskId, 'task-1');
  assert.equal(result.error, 'Invalid state transition from created to completed');
});

test('TaskStateMachine.transition fails for non-existent task', async () => {
  const repository = createMockTaskRepository([]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  const result = await stateMachine.transition('non-existent', 'route', 'user-1');

  assert.equal(result.success, false);
  assert.equal(result.error, 'Task not found: non-existent');
});

test('TaskStateMachine.transition logs audit event on success', async () => {
  const task = createTestTask({ status: 'created' });
  const repository = createMockTaskRepository([task]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  await stateMachine.transition('task-1', 'route', 'user-1');

  const logs = await auditLogger.query({ entityId: 'task-1' });
  assert.ok(logs.length > 0);
  assert.equal(logs[0].entityType, 'task');
  assert.equal(logs[0].action, 'status_changed');
  assert.equal(logs[0].actor, 'user-1');
});

test('TaskStateMachine.getAvailableTransitions returns valid events for state', async () => {
  const task = createTestTask({ status: 'created' });
  const repository = createMockTaskRepository([task]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  const transitions = await stateMachine.getAvailableTransitions('task-1');

  assert.ok(transitions.includes('routed'));
  assert.ok(transitions.includes('running'));
  assert.ok(transitions.includes('waiting_approval'));
  assert.ok(transitions.includes('cancelled'));
});

test('TaskStateMachine.getAvailableTransitions returns empty for terminal states', async () => {
  const completedTask = createTestTask({ status: 'completed' });
  const repository = createMockTaskRepository([completedTask]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  const transitions = await stateMachine.getAvailableTransitions('task-1');

  assert.deepEqual(transitions, []);
});

test('TaskStateMachine.getAvailableTransitions returns empty for non-existent task', async () => {
  const repository = createMockTaskRepository([]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  const transitions = await stateMachine.getAvailableTransitions('non-existent');

  assert.deepEqual(transitions, []);
});

test('TaskStateMachine.transition handles all valid state transitions', async () => {
  const testCases: Array<{
    from: TaskRecord['status'];
    event: TaskEvent;
    to: TaskRecord['status'];
  }> = [
    { from: 'created', event: 'route', to: 'routed' },
    { from: 'created', event: 'request_approval', to: 'waiting_approval' },
    { from: 'created', event: 'start_execution', to: 'running' },
    { from: 'created', event: 'cancel', to: 'cancelled' },
    { from: 'routed', event: 'request_approval', to: 'waiting_approval' },
    { from: 'routed', event: 'start_execution', to: 'running' },
    { from: 'routed', event: 'cancel', to: 'cancelled' },
    { from: 'waiting_approval', event: 'approve', to: 'routed' },
    { from: 'waiting_approval', event: 'reject', to: 'failed' },
    { from: 'waiting_approval', event: 'cancel', to: 'cancelled' },
    { from: 'running', event: 'complete_execution', to: 'completed' },
    { from: 'running', event: 'fail_execution', to: 'failed' },
    { from: 'running', event: 'cancel', to: 'cancelled' },
  ];

  for (const testCase of testCases) {
    const task = createTestTask({ status: testCase.from });
    const repository = createMockTaskRepository([task]);
    const auditLogger = createMockAuditLogger();
    const stateMachine = createTaskStateMachine(repository, auditLogger);

    const result = await stateMachine.transition('task-1', testCase.event, 'system');

    assert.equal(result.success, true, `Transition from ${testCase.from} to ${testCase.to} via ${testCase.event} should succeed`);
    assert.equal(result.newStatus, testCase.to);
    assert.equal(result.previousStatus, testCase.from);
  }
});

test('TaskStateMachine.transition includes custom reason in audit log', async () => {
  const task = createTestTask({ status: 'running' });
  const repository = createMockTaskRepository([task]);
  const auditLogger = createMockAuditLogger();
  const stateMachine = createTaskStateMachine(repository, auditLogger);

  await stateMachine.transition('task-1', 'fail_execution', 'system', 'Execution timeout');

  const logs = await auditLogger.query({ entityId: 'task-1' });
  assert.ok(logs.length > 0);
  assert.equal(logs[0].reason, 'Execution timeout');
});
