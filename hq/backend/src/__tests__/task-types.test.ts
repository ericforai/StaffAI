import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVAL_STATUSES,
  DEFAULT_ADVANCED_EXECUTION_MODE,
  EXECUTION_STATUSES,
  TASK_EXECUTION_MODES,
  TASK_STATUSES,
} from '../shared/task-types';

test('shared task vocabulary exports explicit status collections', () => {
  assert.deepEqual(TASK_STATUSES, ['created', 'routed', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']);
  assert.deepEqual(APPROVAL_STATUSES, ['pending', 'approved', 'rejected']);
  assert.deepEqual(EXECUTION_STATUSES, ['pending', 'running', 'completed', 'failed', 'degraded']);
});

test('advanced discussion mode is preserved as an execution mode', () => {
  assert.equal(TASK_EXECUTION_MODES.includes('advanced_discussion'), true);
  assert.equal(DEFAULT_ADVANCED_EXECUTION_MODE, 'advanced_discussion');
});
