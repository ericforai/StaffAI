import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ApprovalRecord, ExecutionRecord, TaskAssignment, TaskRecord, ToolCallLog, WorkflowPlan } from '../shared/task-types';
import {
  createFileApprovalRepository,
  createFileExecutionRepository,
  createFileTaskAssignmentRepository,
  createFileTaskRepository,
  createFileToolCallLogRepository,
  createFileWorkflowPlanRepository,
  createInMemoryApprovalRepository,
  createInMemoryExecutionRepository,
  createInMemoryTaskAssignmentRepository,
  createInMemoryTaskRepository,
  createInMemoryToolCallLogRepository,
  createInMemoryWorkflowPlanRepository,
} from '../persistence/file-repositories';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Sample task',
    description: 'Sample description',
    taskType: 'general',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: '2026-03-24T00:00:00.000Z',
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect'],
    routeReason: 'matched by default',
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

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id: 'assignment-1',
    taskId: 'task-1',
    agentId: 'software-architect',
    assignmentRole: 'primary',
    status: 'pending',
    ...overrides,
  };
}

function makeWorkflowPlan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
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
    ...overrides,
  };
}

function makeToolCallLog(overrides: Partial<ToolCallLog> = {}): ToolCallLog {
  return {
    id: 'tool-call-log-1',
    toolId: 'read-file',
    toolName: 'Read File',
    actorRole: 'software-architect',
    riskLevel: 'low',
    taskId: 'task-1',
    executionId: 'execution-1',
    status: 'pending',
    inputSummary: '{"path":"README.md"}',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
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

test('file-backed task assignment repository supports list/get/save/update/listByTaskId', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assignment-repo-'));
  const filePath = path.join(tempDir, 'assignments.json');
  const repository = createFileTaskAssignmentRepository(filePath);

  await repository.save(makeAssignment());
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.listByTaskId('task-1')).length, 1);
  assert.equal((await repository.getById('assignment-1'))?.agentId, 'software-architect');

  const updated = await repository.update('assignment-1', (assignment) => ({
    ...assignment,
    status: 'completed',
    resultSummary: 'done',
  }));
  assert.equal(updated?.status, 'completed');
  assert.equal((await repository.getById('assignment-1'))?.resultSummary, 'done');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('file-backed workflow plan repository supports get/save/update', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-plan-repo-'));
  const filePath = path.join(tempDir, 'workflow-plans.json');
  const repository = createFileWorkflowPlanRepository(filePath);

  await repository.save(makeWorkflowPlan());
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.getByTaskId('task-1'))?.id, 'plan-1');

  const updated = await repository.update('task-1', (plan) => ({
    ...plan,
    synthesisRequired: true,
  }));
  assert.equal(updated?.synthesisRequired, true);
  assert.equal((await repository.getByTaskId('task-1'))?.synthesisRequired, true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('file-backed tool call log repository supports list/get/save/update/listByTaskId', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-call-log-repo-'));
  const filePath = path.join(tempDir, 'tool-call-logs.json');
  const repository = createFileToolCallLogRepository(filePath);

  await repository.save(makeToolCallLog());
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.listByTaskId('task-1')).length, 1);
  assert.equal((await repository.listByExecutionId('execution-1')).length, 1);
  assert.equal((await repository.getById('tool-call-log-1'))?.toolName, 'Read File');

  const updated = await repository.update('tool-call-log-1', (toolCallLog) => ({
    ...toolCallLog,
    status: 'completed',
    output: '{"ok":true}',
  }));
  assert.equal(updated?.status, 'completed');
  assert.equal((await repository.getById('tool-call-log-1'))?.output, '{"ok":true}');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('in-memory repositories support non-file-backed persistence mode', async () => {
  const taskRepository = createInMemoryTaskRepository();
  const approvalRepository = createInMemoryApprovalRepository();
  const executionRepository = createInMemoryExecutionRepository();
  const assignmentRepository = createInMemoryTaskAssignmentRepository();
  const toolCallLogRepository = createInMemoryToolCallLogRepository();
  const workflowPlanRepository = createInMemoryWorkflowPlanRepository();

  await taskRepository.save(makeTask());
  await approvalRepository.save(makeApproval());
  await executionRepository.save(makeExecution());
  await assignmentRepository.save(makeAssignment());
  await toolCallLogRepository.save(makeToolCallLog());
  await workflowPlanRepository.save(makeWorkflowPlan());

  assert.equal((await taskRepository.list()).length, 1);
  assert.equal((await approvalRepository.list()).length, 1);
  assert.equal((await executionRepository.list()).length, 1);
  assert.equal((await assignmentRepository.list()).length, 1);
  assert.equal((await toolCallLogRepository.list()).length, 1);
  assert.equal((await workflowPlanRepository.list()).length, 1);

  assert.equal((await taskRepository.getById('task-1'))?.id, 'task-1');
  assert.equal((await approvalRepository.listByTaskId('task-1')).length, 1);
  assert.equal((await executionRepository.listByTaskId('task-1')).length, 1);
  assert.equal((await assignmentRepository.listByTaskId('task-1')).length, 1);
  assert.equal((await toolCallLogRepository.listByTaskId('task-1')).length, 1);
  assert.equal((await toolCallLogRepository.listByExecutionId('execution-1')).length, 1);
  assert.equal((await workflowPlanRepository.getByTaskId('task-1'))?.id, 'plan-1');
});
