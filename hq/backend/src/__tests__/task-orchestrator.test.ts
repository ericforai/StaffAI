import test from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../store';
import type { TaskAssignment, TaskRecord } from '../shared/task-types';
import {
  advanceAssignmentState,
  advanceTaskState,
  createTaskDraft,
  validateTaskDraft,
} from '../orchestration/task-orchestrator';

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
  const savedWorkflowPlans: unknown[] = [];
  const savedTaskAssignments: unknown[] = [];
  const store = {
    async saveTask(task) {
      savedTasks.push(task);
    },
    async saveApproval(approval) {
      savedApprovals.push(approval);
    },
    async saveWorkflowPlan(plan) {
      savedWorkflowPlans.push(plan);
    },
    async saveTaskAssignment(assignment) {
      savedTaskAssignments.push(assignment);
    },
  } as Pick<Store, 'saveTask' | 'saveApproval' | 'saveWorkflowPlan' | 'saveTaskAssignment'>;

  const task = await createTaskDraft(
    {
      title: 'Refactor server composition',
      description: 'Split route registration from domain logic',
    },
    store
  );

  assert.equal(task.title, 'Refactor server composition');
  assert.equal(task.taskType, 'architecture');
  assert.equal(task.priority, 'medium');
  assert.equal(task.requestedBy, 'system');
  assert.equal(task.status, 'waiting_approval');
  assert.equal(task.recommendedAgentRole, 'software-architect');
  assert.deepEqual(task.candidateAgentRoles, ['software-architect', 'dispatcher']);
  assert.equal(task.routingStatus, 'matched');
  assert.equal(savedTasks.length, 1);
  assert.equal(savedApprovals.length, 1);
  assert.equal(savedWorkflowPlans.length, 1);
  assert.equal(savedTaskAssignments.length, 2);
});

test('advanceTaskState enforces task state transitions', () => {
  const task: TaskRecord = {
    id: 'task-1',
    title: 'Test task',
    description: 'description',
    taskType: 'general',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: '2026-03-25T00:00:00.000Z',
    recommendedAgentRole: 'dispatcher',
    candidateAgentRoles: ['dispatcher'],
    routeReason: 'triage',
    routingStatus: 'manual_review',
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  };

  const running = advanceTaskState(task, 'running');
  assert.equal(running.status, 'running');
  assert.throws(() => advanceTaskState(task, 'completed'));
});

test('advanceAssignmentState enforces assignment state transitions', () => {
  const assignment: TaskAssignment = {
    id: 'assignment-1',
    taskId: 'task-1',
    agentId: 'dispatcher',
    assignmentRole: 'dispatcher',
    status: 'pending',
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  };

  const running = advanceAssignmentState(assignment, 'running');
  assert.equal(running.status, 'running');
  assert.equal(typeof running.startedAt, 'string');

  const completed = advanceAssignmentState(running, 'completed');
  assert.equal(completed.status, 'completed');
  assert.equal(typeof completed.completedAt, 'string');
  assert.throws(() => advanceAssignmentState(completed, 'pending'));
});
