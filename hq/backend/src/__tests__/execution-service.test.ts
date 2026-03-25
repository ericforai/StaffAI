import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginExecution,
  failExecution,
  completeExecution,
  buildSerialWorkflowPlan,
  runTaskExecution,
  type ExecutionLifecycleRecord,
} from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';

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

test('buildSerialWorkflowPlan creates ordered steps with assignments', () => {
  const { workflowPlan, assignments } = buildSerialWorkflowPlan({
    id: 'task-serial',
    title: 'Split runtime from API',
    description: 'Create a serial baseline',
    executionMode: 'serial',
    recommendedAgentRole: 'software-architect',
  });

  assert.equal(workflowPlan.mode, 'serial');
  assert.equal(workflowPlan.taskId, 'task-serial');
  assert.equal(workflowPlan.steps.length, 2);
  assert.equal(assignments.length, 2);
  assert.equal(workflowPlan.steps[0]?.assignmentId, assignments[0]?.id);
  assert.equal(assignments[0]?.agentId, 'software-architect');
  assert.equal(assignments[0]?.assignmentRole, 'primary');
  assert.equal(assignments[1]?.assignmentRole, 'dispatcher');
});

test('runTaskExecution serializes assignment-aware execution records', async () => {
  const savedExecutions: ExecutionLifecycleRecord[] = [];
  const updatedTasks: string[] = [];
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      savedExecutions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      const updated = updater(savedExecutions[0]);
      savedExecutions[0] = updated;
      return updated;
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      updatedTasks.push('updated');
      return updater({
        id: 'task-serial',
        title: 'Split runtime from API',
        description: 'Create a serial baseline',
        taskType: 'architecture_analysis',
        priority: 'medium',
        status: 'running',
        executionMode: 'serial',
        approvalRequired: false,
        riskLevel: 'low',
        requestedBy: 'system',
        requestedAt: '2026-03-24T00:00:00.000Z',
        recommendedAgentRole: 'software-architect',
        candidateAgentRoles: ['software-architect', 'dispatcher'],
        routeReason: 'matched by default',
        routingStatus: 'matched',
        createdAt: 'now',
        updatedAt: 'now',
      });
    },
  } as const;

  const result = await runTaskExecution(
    {
      taskId: 'task-serial',
      executor: 'codex',
      summary: 'serial execution completed',
      executionMode: 'serial',
    },
    store
  );

  assert.equal(result.execution.status, 'completed');
  assert.equal(result.execution.outputSummary, 'serial execution completed');
  assert.equal(result.execution.runtimeName, 'local_codex_cli');
  assert.equal(result.execution.retryCount, 0);
  assert.equal(result.execution.maxRetries, 1);
  assert.equal(result.workflowPlan?.mode, 'serial');
  assert.equal(result.assignments?.length, 2);
  assert.equal(result.execution.workflowPlan?.mode, 'serial');
  assert.equal(result.execution.assignments?.length, 2);
  assert.equal(updatedTasks.length, 1);
});

test('runTaskExecution retries retriable runtime errors before succeeding', async () => {
  const savedExecutions: ExecutionLifecycleRecord[] = [];
  let attempts = 0;
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      savedExecutions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      savedExecutions[0] = updater(savedExecutions[0]);
      return savedExecutions[0];
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      return updater({
        id: 'task-retry',
        title: 'Retry runtime',
        description: 'retry path',
        taskType: 'general',
        priority: 'medium',
        status: 'running',
        executionMode: 'single',
        approvalRequired: false,
        riskLevel: 'low',
        requestedBy: 'system',
        requestedAt: '2026-03-24T00:00:00.000Z',
        recommendedAgentRole: 'dispatcher',
        candidateAgentRoles: ['dispatcher'],
        routeReason: 'retry test',
        routingStatus: 'manual_review',
        createdAt: 'now',
        updatedAt: 'now',
      });
    },
  } as const;

  const result = await runTaskExecution(
    {
      taskId: 'task-retry',
      executor: 'codex',
      summary: 'final summary',
      maxRetries: 2,
      runtimeRunner: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('Execution timed out after 10ms');
        }
        return {
          outputSummary: 'final summary',
          outputSnapshot: { attempts },
        };
      },
      timeoutMs: 10,
    },
    store,
  );

  assert.equal(result.execution.status, 'completed');
  assert.equal(result.execution.retryCount, 1);
  assert.equal(result.execution.outputSnapshot?.attempts, 2);
});

test('runTaskExecution stores structured failure when retries are exhausted', async () => {
  const savedExecutions: ExecutionLifecycleRecord[] = [];
  const store = {
    async saveExecution(execution: ExecutionLifecycleRecord) {
      savedExecutions.push(execution);
    },
    async updateExecution(_id: string, updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord) {
      savedExecutions[0] = updater(savedExecutions[0]);
      return savedExecutions[0];
    },
    async updateTask(_id: string, updater: (task: TaskRecord) => TaskRecord) {
      return updater({
        id: 'task-failure',
        title: 'Fail runtime',
        description: 'failure path',
        taskType: 'general',
        priority: 'medium',
        status: 'running',
        executionMode: 'single',
        approvalRequired: false,
        riskLevel: 'low',
        requestedBy: 'system',
        requestedAt: '2026-03-24T00:00:00.000Z',
        recommendedAgentRole: 'dispatcher',
        candidateAgentRoles: ['dispatcher'],
        routeReason: 'failure test',
        routingStatus: 'manual_review',
        createdAt: 'now',
        updatedAt: 'now',
      });
    },
  } as const;

  const result = await runTaskExecution(
    {
      taskId: 'task-failure',
      executor: 'claude',
      summary: 'unused',
      maxRetries: 1,
      timeoutMs: 5,
      runtimeRunner: async () => {
        throw new Error('Execution timed out after 5ms');
      },
    },
    store,
  );

  assert.equal(result.execution.status, 'failed');
  assert.equal(result.execution.retryCount, 1);
  assert.equal(result.execution.structuredError?.code, 'timeout');
  assert.equal(result.execution.structuredError?.retriable, true);
});
