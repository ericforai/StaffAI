import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApprovalRepository, ExecutionRepository, TaskRepository } from '../persistence/file-repositories';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';
import { Store } from '../store';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Sample task',
    description: 'Sample description',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    recommendedAgentRole: 'software-architect',
    routingStatus: 'matched',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

function makeApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: 'approval-1',
    taskId: 'task-1',
    status: 'pending',
    requestedBy: 'system',
    requestedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

function makeExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: 'execution-1',
    taskId: 'task-1',
    status: 'pending',
    executor: 'codex',
    ...overrides,
  };
}

test('store delegates task/approval/execution operations through injected repositories', async () => {
  const tasks: TaskRecord[] = [];
  const approvals: ApprovalRecord[] = [];
  const executions: ExecutionRecord[] = [];

  const taskRepository: TaskRepository = {
    list: async () => [...tasks],
    getById: async (id) => tasks.find((task) => task.id === id) || null,
    save: async (task) => {
      tasks.push(task);
    },
    update: async (id, updater) => {
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) return null;
      tasks[index] = updater(tasks[index]);
      return tasks[index];
    },
  };

  const approvalRepository: ApprovalRepository = {
    list: async () => [...approvals],
    listByTaskId: async (taskId) => approvals.filter((approval) => approval.taskId === taskId),
    save: async (approval) => {
      approvals.push(approval);
    },
    updateStatus: async (approvalId, status) => {
      const index = approvals.findIndex((approval) => approval.id === approvalId);
      if (index < 0) return null;
      approvals[index] = {
        ...approvals[index],
        status,
        resolvedAt: new Date().toISOString(),
      };
      return approvals[index];
    },
  };

  const executionRepository: ExecutionRepository = {
    list: async () => [...executions],
    getById: async (id) => executions.find((execution) => execution.id === id) || null,
    listByTaskId: async (taskId) => executions.filter((execution) => execution.taskId === taskId),
    save: async (execution) => {
      executions.push(execution);
    },
    update: async (id, updater) => {
      const index = executions.findIndex((execution) => execution.id === id);
      if (index < 0) return null;
      executions[index] = updater(executions[index]);
      return executions[index];
    },
  };

  const store = new Store({
    taskRepository,
    approvalRepository,
    executionRepository,
  });

  await store.saveTask(makeTask());
  await store.saveApproval(makeApproval());
  await store.saveExecution(makeExecution());

  assert.equal((await store.getTasks()).length, 1);
  assert.equal((await store.getApprovals()).length, 1);
  assert.equal((await store.getExecutions()).length, 1);
  assert.equal((await store.getTaskById('task-1'))?.id, 'task-1');
  assert.equal((await store.getExecutionById('execution-1'))?.id, 'execution-1');
  assert.equal((await store.getApprovalsByTaskId('task-1')).length, 1);
  assert.equal((await store.getExecutionsByTaskId('task-1')).length, 1);

  const updatedTask = await store.updateTask('task-1', (task) => ({ ...task, status: 'completed' }));
  const updatedApproval = await store.updateApprovalStatus('approval-1', 'approved');
  const updatedExecution = await store.updateExecution('execution-1', (execution) => ({
    ...execution,
    status: 'completed',
    outputSummary: 'done',
  }));

  assert.equal(updatedTask?.status, 'completed');
  assert.equal(updatedApproval?.status, 'approved');
  assert.equal(updatedExecution?.status, 'completed');
});
