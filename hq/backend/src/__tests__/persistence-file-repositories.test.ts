import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';
import {
  createFileApprovalRepository,
  createFileExecutionRepository,
  createFileTaskRepository,
  createInMemoryApprovalRepository,
  createInMemoryExecutionRepository,
  createInMemoryTaskRepository,
} from '../persistence/file-repositories';

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

test('file-backed task repository supports list/get/save/update', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-repo-'));
  const filePath = path.join(tempDir, 'tasks.json');
  const repository = createFileTaskRepository(filePath);

  assert.deepEqual(await repository.list(), []);
  await repository.save(makeTask());
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.getById('task-1'))?.title, 'Sample task');

  const updated = await repository.update('task-1', (task) => ({ ...task, status: 'completed' }));
  assert.equal(updated?.status, 'completed');
  assert.equal((await repository.getById('task-1'))?.status, 'completed');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('file-backed approval repository supports list/save/updateStatus/listByTaskId', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-repo-'));
  const filePath = path.join(tempDir, 'approvals.json');
  const repository = createFileApprovalRepository(filePath);

  await repository.save(makeApproval());
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.listByTaskId('task-1')).length, 1);

  const updated = await repository.updateStatus('approval-1', 'approved');
  assert.equal(updated?.status, 'approved');
  assert.equal(typeof updated?.resolvedAt, 'string');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('file-backed execution repository supports list/get/save/update/listByTaskId', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-repo-'));
  const filePath = path.join(tempDir, 'executions.json');
  const repository = createFileExecutionRepository(filePath);

  await repository.save(makeExecution());
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.listByTaskId('task-1')).length, 1);
  assert.equal((await repository.getById('execution-1'))?.status, 'pending');

  const updated = await repository.update('execution-1', (execution) => ({
    ...execution,
    status: 'completed',
    outputSummary: 'done',
  }));
  assert.equal(updated?.status, 'completed');
  assert.equal((await repository.getById('execution-1'))?.outputSummary, 'done');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('in-memory repositories support non-file-backed persistence mode', async () => {
  const taskRepository = createInMemoryTaskRepository();
  const approvalRepository = createInMemoryApprovalRepository();
  const executionRepository = createInMemoryExecutionRepository();

  await taskRepository.save(makeTask());
  await approvalRepository.save(makeApproval());
  await executionRepository.save(makeExecution());

  assert.equal((await taskRepository.list()).length, 1);
  assert.equal((await approvalRepository.list()).length, 1);
  assert.equal((await executionRepository.list()).length, 1);

  assert.equal((await taskRepository.getById('task-1'))?.id, 'task-1');
  assert.equal((await approvalRepository.listByTaskId('task-1')).length, 1);
  assert.equal((await executionRepository.listByTaskId('task-1')).length, 1);
});
