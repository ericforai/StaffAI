import test from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../store';
import type { TaskRecord } from '../shared/task-types';
import { executeTaskRecord } from '../orchestration/task-execution-orchestrator';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Execute task',
    description: 'Run task execution',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    recommendedAgentRole: 'software-architect',
    routingStatus: 'matched',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

test('executeTaskRecord runs single execution through runtime service', async () => {
  const task = makeTask();
  const executions: unknown[] = [];
  let updatedTaskStatus = '';
  const store = {
    saveExecution(execution) {
      executions.push(execution);
    },
    updateExecution(_id, updater) {
      const updated = updater(executions[0] as never);
      executions[0] = updated;
      return updated;
    },
    updateTask(_id, updater) {
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
  assert.equal(updatedTaskStatus, 'completed');
});

test('executeTaskRecord loads memory context before execution and writes back summary after completion', async () => {
  const task = makeTask();
  const executions: unknown[] = [];
  const callOrder: string[] = [];
  const store = {
    saveExecution(execution) {
      executions.push(execution);
    },
    updateExecution(_id, updater) {
      const updated = updater(executions[0] as never);
      executions[0] = updated;
      return updated;
    },
    updateTask(_id, updater) {
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
    saveExecution() {},
    updateExecution() {
      return null;
    },
    updateTask() {
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
  const executions: unknown[] = [];
  let updatedTaskStatus = '';
  const store = {
    saveExecution(execution) {
      executions.push(execution);
    },
    updateExecution(_id, updater) {
      const updated = updater(executions[0] as never);
      executions[0] = updated;
      return updated;
    },
    updateTask(_id, updater) {
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
