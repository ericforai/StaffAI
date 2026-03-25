import test from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../store';
import type { TaskRecord } from '../shared/task-types';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import { executeTaskRecord } from '../orchestration/task-execution-orchestrator';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Execute task',
    description: 'Run task execution',
    taskType: 'general',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: '2026-03-24T00:00:00.000Z',
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect'],
    routeReason: 'matched by default',
    routingStatus: 'matched',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

test('executeTaskRecord runs single execution through runtime service', async () => {
  const task = makeTask();
  const executions: ExecutionLifecycleRecord[] = [];
  let updatedTaskStatus = '';
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      executions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      const updated = updater(executions[0]);
      executions[0] = updated;
      return updated;
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      const updated = updater(task);
      updatedTaskStatus = updated.status;
      return updated;
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await executeTaskRecord(
    task,
    {
      executor: 'codex',
      summary: 'done',
    },
    store
  );

  assert.equal(result.execution.status, 'completed');
  assert.equal(result.execution.outputSummary, 'done');
  assert.equal(result.execution.runtimeName, 'local_codex_cli');
  assert.equal(updatedTaskStatus, 'completed');
});

test('executeTaskRecord loads memory context before execution and writes back summary after completion', async () => {
  const task = makeTask();
  const executions: ExecutionLifecycleRecord[] = [];
  const callOrder: string[] = [];
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      executions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      const updated = updater(executions[0]);
      executions[0] = updated;
      return updated;
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      return updater(task);
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  await executeTaskRecord(
    task,
    {
      executor: 'codex',
      summary: 'done',
    },
    store,
    {
      loadMemoryContext: () => {
        callOrder.push('load');
        return 'memory excerpt';
      },
      writeExecutionSummary: () => {
        callOrder.push('write');
      },
    }
  );

  assert.deepEqual(callOrder, ['load', 'write']);
  assert.equal((executions[0] as { memoryContextExcerpt?: string }).memoryContextExcerpt, 'memory excerpt');
});

test('executeTaskRecord keeps advanced discussion as a distinct branch', async () => {
  const task = makeTask({ executionMode: 'advanced_discussion' });
  const store = {
    async saveExecution(_execution: ExecutionLifecycleRecord) {},
    async updateExecution(_id: string, _updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      return null;
    },
    async updateTask(_id: string, _updater: (task: TaskRecord) => TaskRecord) {
      return task;
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await executeTaskRecord(
    task,
    {
      executor: 'codex',
      summary: 'unused',
    },
    store
  );

  assert.equal(result.mode, 'advanced_discussion');
  assert.equal(result.execution.status, 'pending');
  assert.equal(result.execution.outputSummary, undefined);
});

test('executeTaskRecord can complete advanced discussion through an injected runner', async () => {
  const task = makeTask({ executionMode: 'advanced_discussion' });
  const executions: ExecutionLifecycleRecord[] = [];
  let updatedTaskStatus = '';
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      executions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      const updated = updater(executions[0]);
      executions[0] = updated;
      return updated;
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      const updated = updater(task);
      updatedTaskStatus = updated.status;
      return updated;
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await executeTaskRecord(
    task,
    {
      executor: 'codex',
      summary: 'unused',
    },
    store,
    {
      runAdvancedDiscussion: async () => ({
        summary: 'Discussion synthesis',
      }),
    }
  );

  assert.equal(result.mode, 'advanced_discussion');
  assert.equal(result.execution.status, 'completed');
  assert.equal(result.execution.outputSummary, 'Discussion synthesis');
  assert.equal(updatedTaskStatus, 'completed');
});

test('executeTaskRecord emits serial workflow plan and assignments for serial tasks', async () => {
  const task = makeTask({ executionMode: 'serial' });
  const executions: ExecutionLifecycleRecord[] = [];
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      executions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      const updated = updater(executions[0]);
      executions[0] = updated;
      return updated;
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      return updater(task);
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await executeTaskRecord(
    task,
    {
      executor: 'codex',
      summary: 'serial summary',
      executionMode: 'serial',
    },
    store
  );

  assert.equal(result.mode, 'serial');
  assert.equal(result.execution.status, 'completed');
  assert.equal(result.workflowPlan?.mode, 'serial');
  assert.equal(result.assignments?.length, 2);
  assert.equal(result.execution.workflowPlan?.mode, 'serial');
  assert.equal(result.execution.assignments?.[0]?.status, 'completed');
  assert.equal(result.execution.inputSnapshot?.requestedMode, 'serial');
  assert.equal(result.execution.inputSnapshot?.appliedMode, 'serial');
});

test('executeTaskRecord degrades parallel mode to serial when sampling is unavailable', async () => {
  const task = makeTask({ executionMode: 'parallel' });
  const executions: ExecutionLifecycleRecord[] = [];
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      executions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      const updated = updater(executions[0]);
      executions[0] = updated;
      return updated;
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      return updater(task);
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await executeTaskRecord(
    task,
    {
      executor: 'codex',
      summary: 'parallel degraded summary',
      executionMode: 'parallel',
    },
    store,
    {
      sessionCapabilities: { sampling: false },
    },
  );

  assert.equal(result.mode, 'parallel');
  assert.equal(result.execution.status, 'completed');
  assert.equal(result.execution.degraded, true);
  assert.equal(result.execution.inputSnapshot?.requestedMode, 'parallel');
  assert.equal(result.execution.inputSnapshot?.appliedMode, 'serial');
});
