import test from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../store';
import type { ExecutionRecord, TaskRecord } from '../shared/task-types';
import { runAdvancedDiscussionExecution } from '../runtime/advanced-discussion-runner';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Advanced discussion',
    description: 'Test advanced discussion runner',
    status: 'created',
    executionMode: 'advanced_discussion',
    approvalRequired: false,
    riskLevel: 'low',
    recommendedAgentRole: 'workflow-lead',
    routingStatus: 'matched',
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

test('runAdvancedDiscussionExecution keeps the pending record when no runner is provided', async () => {
  const task = makeTask();
  const store = {
    async saveExecution() {},
    async updateExecution() {
      throw new Error('should not update execution without runner');
    },
    async updateTask() {
      throw new Error('should not update task without runner');
    },
  } as unknown as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await runAdvancedDiscussionExecution(task, 'codex', store);

  assert.equal(result.execution.status, 'pending');
  assert.strictEqual(result.task, task);
});

test('runAdvancedDiscussionExecution completes when a runner is injected', async () => {
  const task = makeTask();
  let savedExecution: ExecutionRecord | undefined;
  let updatedTaskStatus = '';

  const store = {
    async saveExecution(execution) {
      savedExecution = execution;
    },
    async updateExecution(_id, updater) {
      if (!savedExecution) {
        throw new Error('execution was not saved');
      }
      savedExecution = updater(savedExecution);
      return savedExecution;
    },
    async updateTask(_id, updater) {
      const updated = updater(task);
      updatedTaskStatus = updated.status;
      return updated;
    },
  } as Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>;

  const result = await runAdvancedDiscussionExecution(
    task,
    'claude',
    store,
    async () => ({ summary: 'synthesis result' })
  );

  assert.equal(result.execution.status, 'completed');
  assert.equal(result.execution.outputSummary, 'synthesis result');
  assert.equal(updatedTaskStatus, 'completed');
  assert.equal(result.task?.status, 'completed');
});
