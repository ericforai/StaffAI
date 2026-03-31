import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVAL_STATUSES,
  DEFAULT_ADVANCED_EXECUTION_MODE,
  EXECUTION_STATUSES,
  TASK_ASSIGNMENT_STATUSES,
  TASK_EXECUTION_MODES,
  TASK_STATUSES,
  TOOL_CALL_STATUSES,
  TOOL_DEFINITION_CATEGORIES,
  WORKFLOW_PLAN_MODES,
} from '../shared/task-types';

test('shared task vocabulary exports explicit status collections', () => {
  assert.deepEqual(TASK_STATUSES, ['created', 'routed', 'queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']);
  assert.deepEqual(APPROVAL_STATUSES, ['pending', 'approved', 'rejected', 'cancelled']);
  assert.deepEqual(EXECUTION_STATUSES, ['pending', 'running', 'paused', 'cancelled', 'completed', 'failed', 'degraded']);
});

test('advanced discussion mode is preserved as an execution mode', () => {
  assert.equal(TASK_EXECUTION_MODES.includes('advanced_discussion'), true);
  assert.equal(DEFAULT_ADVANCED_EXECUTION_MODE, 'advanced_discussion');
});

test('task assignments and workflow plans expose their own vocabulary', () => {
  assert.deepStrictEqual([...TASK_ASSIGNMENT_STATUSES], ['pending', 'running', 'waiting_input', 'completed', 'failed', 'skipped']);
  assert.deepStrictEqual([...WORKFLOW_PLAN_MODES], ['single', 'serial', 'parallel']);
});


test('tool definitions and tool calls expose their own vocabulary', () => {
  assert.deepEqual(TOOL_DEFINITION_CATEGORIES, ['knowledge', 'runtime', 'filesystem', 'repository', 'quality']);
  assert.deepEqual(TOOL_CALL_STATUSES, ['pending', 'running', 'completed', 'failed', 'blocked']);
});
