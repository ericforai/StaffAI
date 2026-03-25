import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApprovalRecord, ExecutionRecord, TaskAssignment, TaskRecord, WorkflowPlan } from '../shared/task-types';
import {
  buildTaskDetailReadModel,
  buildTaskListReadModel,
  buildTaskWorkspaceSummary,
} from '../orchestration/task-read-model';

function makeTask(id: string, createdAt: string): TaskRecord {
  return {
    id,
    title: id,
    description: 'description',
    taskType: 'general',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: createdAt,
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect'],
    routeReason: 'matched by default',
    routingStatus: 'matched',
    createdAt,
    updatedAt: createdAt,
  };
}

test('buildTaskListReadModel awaits async task repositories and sorts newest first', async () => {
  const tasks = [makeTask('task-older', '2026-03-24T00:00:00.000Z'), makeTask('task-newer', '2026-03-24T01:00:00.000Z')];
  const store = {
    async getTasks() {
      return [...tasks];
    },
  };

  const list = await buildTaskListReadModel(store);
  assert.deepEqual(list.map((task) => task.id), ['task-newer', 'task-older']);

  const summary = await buildTaskWorkspaceSummary(list);
  assert.equal(summary.totalTasks, 2);
  assert.equal(summary.statusCounts.routed, 2);
  assert.equal(summary.activeTasks, 2);
  assert.equal(summary.latestCreatedAt, '2026-03-24T01:00:00.000Z');
});

test('buildTaskDetailReadModel awaits async task, approval, execution, and planning repositories', async () => {
  const task = makeTask('task-1', '2026-03-24T00:00:00.000Z');
  const approvals: ApprovalRecord[] = [
    {
      id: 'approval-1',
      taskId: 'task-1',
      status: 'pending',
      requestedBy: 'system',
      requestedAt: '2026-03-24T00:00:00.000Z',
    },
  ];
  const executions: ExecutionRecord[] = [
    {
      id: 'execution-1',
      taskId: 'task-1',
      status: 'completed',
      executor: 'codex',
      outputSummary: 'done',
    },
  ];
  const assignments: TaskAssignment[] = [
    {
      id: 'assignment-1',
      taskId: 'task-1',
      agentId: 'software-architect',
      assignmentRole: 'primary',
      status: 'pending',
    },
  ];
  const workflowPlan: WorkflowPlan = {
    id: 'plan-1',
    taskId: 'task-1',
    mode: 'single',
    synthesisRequired: false,
    steps: [
      {
        id: 'step-1',
        title: 'Draft architecture proposal',
        assignmentId: 'assignment-1',
        agentId: 'software-architect',
        assignmentRole: 'primary',
        status: 'pending',
      },
    ],
  };
  const store = {
    async getTaskById(taskId: string) {
      return taskId === task.id ? task : null;
    },
    async getApprovalsByTaskId(taskId: string) {
      return taskId === task.id ? [...approvals] : [];
    },
    async getExecutionsByTaskId(taskId: string) {
      return taskId === task.id ? [...executions] : [];
    },
    async getTaskAssignmentsByTaskId(taskId: string) {
      return taskId === task.id ? [...assignments] : [];
    },
    async getWorkflowPlanByTaskId(taskId: string) {
      return taskId === task.id ? workflowPlan : null;
    },
  };

  const detail = await buildTaskDetailReadModel(task.id, store);
  assert.equal(detail?.task.id, task.id);
  assert.equal(detail?.approvals.length, 1);
  assert.equal(detail?.executions.length, 1);
  assert.equal(detail?.assignments.length, 1);
  assert.equal(detail?.workflowPlan?.id, 'plan-1');
  assert.equal(detail?.summary.approvalCounts.pending, 1);
  assert.equal(detail?.summary.executionCount, 1);
  assert.equal(detail?.summary.taskStatus, 'routed');
});
