import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';
import { buildTaskDetailReadModel, buildTaskListReadModel } from '../orchestration/task-read-model';

function makeTask(id: string, createdAt: string): TaskRecord {
  return {
    id,
    title: id,
    description: 'description',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    recommendedAgentRole: 'software-architect',
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
});

test('buildTaskDetailReadModel awaits async task, approval, and execution repositories', async () => {
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
  };

  const detail = await buildTaskDetailReadModel(task.id, store);
  assert.equal(detail?.task.id, task.id);
  assert.equal(detail?.approvals.length, 1);
  assert.equal(detail?.executions.length, 1);
});
