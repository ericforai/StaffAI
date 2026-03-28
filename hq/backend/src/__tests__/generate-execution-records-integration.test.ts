/**
 * Integration tests for execution record generation and persistence
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Store } from '../store';
import { generateExecutionRecords } from '../scripts/generate-execution-records';
import type { ExecutionRecord } from '../shared/task-types';

describe('generate-execution-records-integration', () => {
  let store: Store;
  const testTaskId = randomUUID();

  before(async () => {
    // Create in-memory store for testing
    store = new Store({
      taskRepository: undefined,
      approvalRepository: undefined,
      executionRepository: undefined,
      taskAssignmentRepository: undefined,
      workflowPlanRepository: undefined,
      toolCallLogRepository: undefined,
      executionTraceRepository: undefined,
      costLogRepository: undefined,
      knowledgeAdapter: undefined,
      auditLogRepository: undefined,
    });
  });

  it('should persist generated execution records to store', async () => {
    const count = 5;
    const executions = await generateExecutionRecords({
      count,
      taskId: testTaskId,
    });

    // Persist all executions to store
    for (const execution of executions) {
      await store.saveExecution(execution);
    }

    // Verify all executions were saved
    const savedExecutions = await store.getExecutionsByTaskId(testTaskId);

    assert.equal(
      savedExecutions.length,
      count,
      `Expected ${count} executions, but got ${savedExecutions.length}`
    );

    // Verify execution properties
    for (const saved of savedExecutions) {
      assert.ok(saved.id, 'Execution should have an ID');
      assert.ok(saved.displayExecutionId, 'Execution should have a display ID');
      assert.equal(saved.taskId, testTaskId, 'Task ID should match');
      assert.ok(['completed', 'failed', 'cancelled', 'paused', 'running', 'pending', 'degraded'].includes(saved.status),
        `Status should be valid: ${saved.status}`);
    }
  });

  it('should persist execution records with various statuses', async () => {
    const count = 20;
    const executions = await generateExecutionRecords({
      count,
      taskId: testTaskId,
    });

    // Save executions to store
    for (const execution of executions) {
      await store.saveExecution(execution);
    }

    const allExecutions = await store.getExecutions();

    // Verify we have executions with different statuses
    const statusCounts: Record<string, number> = {};
    for (const execution of allExecutions) {
      statusCounts[execution.status] = (statusCounts[execution.status] || 0) + 1;
    }

    // Should have at least some completed executions
    assert.ok(
      statusCounts.completed > 0,
      'Should have at least one completed execution'
    );

    // Should have some variety in statuses
    const uniqueStatuses = Object.keys(statusCounts);
    assert.ok(
      uniqueStatuses.length >= 2,
      `Should have at least 2 different statuses, got: ${uniqueStatuses.join(', ')}`
    );
  });

  it('should generate and persist executions with correct timestamps', async () => {
    const count = 10;
    const daysBack = 7;
    const executions = await generateExecutionRecords({
      count,
      taskId: testTaskId,
      daysBack,
    });

    // Save executions to store
    for (const execution of executions) {
      await store.saveExecution(execution);
    }

    const savedExecutions = await store.getExecutionsByTaskId(testTaskId);

    const now = Date.now();
    const daysBackMs = daysBack * 24 * 60 * 60 * 1000;

    for (const execution of savedExecutions) {
      assert.ok(execution.startedAt, 'Execution should have startedAt timestamp');

      const startedAtTime = new Date(execution.startedAt).getTime();
      assert.ok(
        startedAtTime <= now,
        `startedAt should be in the past or now`
      );
      assert.ok(
        startedAtTime >= now - daysBackMs - 60000, // +1 minute buffer
        `startedAt should be within ${daysBack} days`
      );
    }
  });
});
