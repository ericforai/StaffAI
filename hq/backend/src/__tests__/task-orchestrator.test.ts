import test from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../store';
import { createTaskDraft, validateTaskDraft } from '../orchestration/task-orchestrator';

test('validateTaskDraft accepts non-empty title and description', () => {
  const validation = validateTaskDraft({
    title: 'Create task API',
    description: 'Add a route that creates tasks with routing metadata',
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.error, undefined);
});

test('validateTaskDraft rejects empty fields', () => {
  const validation = validateTaskDraft({
    title: '   ',
    description: '',
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.error, 'title and description are required');
});

test('createTaskDraft builds a routed task and persists it via store', async () => {
  const savedTasks: unknown[] = [];
  const savedApprovals: unknown[] = [];
  const store = {
    async saveTask(task) {
      savedTasks.push(task);
    },
    async saveApproval(approval) {
      savedApprovals.push(approval);
    },
  } as Pick<Store, 'saveTask' | 'saveApproval'>;

  const task = await createTaskDraft(
    {
      title: 'Refactor server composition',
      description: 'Split route registration from domain logic',
    },
    store
  );

  assert.equal(task.title, 'Refactor server composition');
  assert.equal(task.status, 'created');
  assert.equal(task.recommendedAgentRole, 'software-architect');
  assert.equal(task.routingStatus, 'matched');
  assert.equal(savedTasks.length, 1);
  assert.equal(savedApprovals.length, 0);
});
