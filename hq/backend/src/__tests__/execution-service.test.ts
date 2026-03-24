import test from 'node:test';
import assert from 'node:assert/strict';
import { beginExecution, failExecution, completeExecution } from '../runtime/execution-service';

test('beginExecution creates a pending execution record for a task', () => {
  const execution = beginExecution({
    taskId: 'task-1',
    executor: 'codex',
  });

  assert.equal(execution.taskId, 'task-1');
  assert.equal(execution.status, 'pending');
  assert.equal(execution.executor, 'codex');
  assert.equal(typeof execution.id, 'string');
  assert.equal(typeof execution.startedAt, 'string');
});

test('completeExecution marks execution as completed', () => {
  const execution = beginExecution({
    taskId: 'task-1',
    executor: 'claude',
  });

  const completed = completeExecution(execution, { summary: 'done' });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.outputSummary, 'done');
  assert.equal(typeof completed.completedAt, 'string');
});

test('failExecution marks execution as failed', () => {
  const execution = beginExecution({
    taskId: 'task-1',
    executor: 'claude',
  });

  const failed = failExecution(execution, { errorMessage: 'executor unavailable' });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorMessage, 'executor unavailable');
  assert.equal(typeof failed.completedAt, 'string');
});
