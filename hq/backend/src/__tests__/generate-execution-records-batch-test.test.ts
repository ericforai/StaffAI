/**
 * Tests for generating multiple batches of execution records
 * Tests the "second execution" scenario - generating additional records
 * for the same or different tasks to test history endpoint behavior
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  generateExecutionRecords,
  type GenerateOptions,
} from '../scripts/generate-execution-records';

test('generateExecutionRecords: second batch with same task ID', async () => {
  // First batch
  const taskId = randomUUID();
  const firstBatchOptions: GenerateOptions = {
    count: 5,
    taskId,
    daysBack: 7,
  };

  const firstBatch = await generateExecutionRecords(firstBatchOptions);

  assert.equal(firstBatch.length, 5);
  assert.equal(firstBatch[0].taskId, taskId);

  // Wait a moment to ensure different timestamps
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Second batch - same task, more executions
  const secondBatchOptions: GenerateOptions = {
    count: 3,
    taskId,
    daysBack: 3,
  };

  const secondBatch = await generateExecutionRecords(secondBatchOptions);

  assert.equal(secondBatch.length, 3);
  assert.equal(secondBatch[0].taskId, taskId);

  // Verify all executions share the same task ID
  for (const execution of [...firstBatch, ...secondBatch]) {
    assert.equal(execution.taskId, taskId, 'All executions should have the same task ID');
  }

  // Verify all display IDs are unique across both batches
  const allDisplayIds = new Set([
    ...firstBatch.map((e) => e.displayExecutionId),
    ...secondBatch.map((e) => e.displayExecutionId),
  ]);

  assert.equal(
    allDisplayIds.size,
    8,
    'All display execution IDs should be unique across both batches'
  );
});

test('generateExecutionRecords: second batch with different task ID', async () => {
  // First batch - task A
  const taskAId = randomUUID();
  const firstBatchOptions: GenerateOptions = {
    count: 5,
    taskId: taskAId,
  };

  const firstBatch = await generateExecutionRecords(firstBatchOptions);

  // Second batch - task B
  const taskBId = randomUUID();
  const secondBatchOptions: GenerateOptions = {
    count: 7,
    taskId: taskBId,
  };

  const secondBatch = await generateExecutionRecords(secondBatchOptions);

  // Verify task IDs are different
  assert.equal(firstBatch[0].taskId, taskAId);
  assert.equal(secondBatch[0].taskId, taskBId);
  assert.notEqual(taskAId, taskBId);

  // Verify display IDs are unique across both batches
  const allDisplayIds = new Set([
    ...firstBatch.map((e) => e.displayExecutionId),
    ...secondBatch.map((e) => e.displayExecutionId),
  ]);

  assert.equal(
    allDisplayIds.size,
    12,
    'All display execution IDs should be unique across both batches'
  );
});

test('generateExecutionRecords: timestamps are properly distributed across batches', async () => {
  const taskId = randomUUID();
  const now = Date.now();

  // First batch - older executions (7 days back)
  const firstBatchOptions: GenerateOptions = {
    count: 5,
    taskId,
    daysBack: 7,
  };

  const firstBatch = await generateExecutionRecords(firstBatchOptions);

  // Second batch - newer executions (2 days back)
  const secondBatchOptions: GenerateOptions = {
    count: 5,
    taskId,
    daysBack: 2,
  };

  const secondBatch = await generateExecutionRecords(secondBatchOptions);

  // All first batch should be older than all second batch
  const oldestOfSecondBatch = Math.min(
    ...secondBatch.map((e) => new Date(e.startedAt).getTime())
  );
  const newestOfFirstBatch = Math.max(
    ...firstBatch.map((e) => new Date(e.startedAt).getTime())
  );

  assert.ok(
    oldestOfSecondBatch > newestOfFirstBatch,
    'Second batch should be newer than first batch'
  );

  // Verify all timestamps are in the past
  for (const execution of [...firstBatch, ...secondBatch]) {
    const startedAt = new Date(execution.startedAt).getTime();
    assert.ok(startedAt <= now, 'Execution should have started in the past or now');
  }
});

test('generateExecutionRecords: status distribution across multiple batches', async () => {
  const taskId = randomUUID();

  // Generate three batches
  const batches: GenerateOptions[] = [
    { count: 20, taskId, daysBack: 7 },
    { count: 20, taskId, daysBack: 5 },
    { count: 20, taskId, daysBack: 3 },
  ];

  const allExecutions = await Promise.all(
    batches.map((opts) => generateExecutionRecords(opts))
  );

  const flattened = allExecutions.flat();

  // Count statuses
  const statusCounts: Record<string, number> = {};
  for (const execution of flattened) {
    statusCounts[execution.status] = (statusCounts[execution.status] || 0) + 1;
  }

  // Verify we have a good distribution
  assert.equal(flattened.length, 60, 'Should have 60 total executions');
  assert.ok(statusCounts.completed > 15, 'Should have significant number of completed executions');
  assert.ok(statusCounts.failed > 0, 'Should have at least some failed executions');

  // Verify multiple status types are represented
  const uniqueStatuses = Object.keys(statusCounts);
  assert.ok(uniqueStatuses.length >= 3, 'Should have at least 3 different statuses');
});

test('generateExecutionRecords: can generate sequential batches for pagination testing', async () => {
  const pageSize = 10;
  const totalPages = 3;

  const allExecutions: ReturnType<typeof generateExecutionRecords> = [];

  // Generate sequential batches
  for (let page = 0; page < totalPages; page++) {
    const batch = await generateExecutionRecords({
      count: pageSize,
      daysBack: 7 - page, // Each batch slightly newer
    });
    allExecutions.push(...batch);
  }

  assert.equal(allExecutions.length, pageSize * totalPages, 'Should have total executions equal to page size * pages');

  // Verify all display IDs are unique
  const displayIds = new Set(allExecutions.map((e) => e.displayExecutionId));
  assert.equal(displayIds.size, allExecutions.length, 'All display IDs should be unique');

  // Verify we can extract pages
  for (let page = 0; page < totalPages; page++) {
    const start = page * pageSize;
    const end = start + pageSize;
    const pageExecutions = allExecutions.slice(start, end);

    assert.equal(pageExecutions.length, pageSize, `Page ${page} should have ${pageSize} executions`);
  }
});

test('generateExecutionRecords: cumulative batches maintain data integrity', async () => {
  const taskId = randomUUID();

  // Start with small batch
  const batch1 = await generateExecutionRecords({
    count: 3,
    taskId,
  });

  // Add more executions
  const batch2 = await generateExecutionRecords({
    count: 5,
    taskId,
  });

  // Add even more
  const batch3 = await generateExecutionRecords({
    count: 7,
    taskId,
  });

  const allExecutions = [...batch1, ...batch2, ...batch3];

  // Verify cumulative count
  assert.equal(allExecutions.length, 15, 'Total should be sum of all batches');

  // Verify all share same task ID
  const uniqueTaskIds = new Set(allExecutions.map((e) => e.taskId));
  assert.equal(uniqueTaskIds.size, 1, 'All should share the same task ID');

  // Verify all display IDs are unique
  const displayIds = new Set(allExecutions.map((e) => e.displayExecutionId));
  assert.equal(displayIds.size, 15, 'All display IDs should be unique');

  // Verify required fields on all records
  for (const execution of allExecutions) {
    assert.ok(execution.id, 'Execution should have an ID');
    assert.ok(execution.displayExecutionId, 'Execution should have display ID');
    assert.ok(execution.startedAt, 'Execution should have startedAt');
    assert.ok(typeof execution.status === 'string', 'Execution should have status');
  }
});

test('generateExecutionRecords: batches can be filtered by status', async () => {
  const taskId = randomUUID();

  // Generate large batch to ensure variety
  const batch = await generateExecutionRecords({
    count: 50,
    taskId,
  });

  // Filter by completed status
  const completed = batch.filter((e) => e.status === 'completed');
  assert.ok(completed.length > 10, 'Should have multiple completed executions');

  // Filter by failed status
  const failed = batch.filter((e) => e.status === 'failed');
  assert.ok(failed.length > 0, 'Should have at least some failed executions');

  // Verify filtered records maintain integrity
  for (const execution of completed) {
    assert.equal(execution.status, 'completed');
    assert.ok(execution.outputSnapshot, 'Completed execution should have output snapshot');
    assert.ok(execution.outputSummary, 'Completed execution should have output summary');
  }

  for (const execution of failed) {
    assert.equal(execution.status, 'failed');
    assert.ok(execution.structuredError, 'Failed execution should have structured error');
    assert.ok(execution.errorMessage, 'Failed execution should have error message');
  }
});

test('generateExecutionRecords: batches can be sorted by various fields', async () => {
  const taskId = randomUUID();

  const batch = await generateExecutionRecords({
    count: 20,
    taskId,
  });

  // Sort by startedAt ascending
  const byStartedAsc = [...batch].sort((a, b) => {
    return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
  });

  // Verify ascending order
  for (let i = 0; i < byStartedAsc.length - 1; i++) {
    const current = new Date(byStartedAsc[i].startedAt).getTime();
    const next = new Date(byStartedAsc[i + 1].startedAt).getTime();
    assert.ok(current <= next, 'Should be sorted in ascending order');
  }

  // Sort by displayExecutionId
  const byDisplayId = [...batch].sort((a, b) => {
    const aNum = parseInt(a.displayExecutionId.split('-')[1], 10);
    const bNum = parseInt(b.displayExecutionId.split('-')[1], 10);
    return aNum - bNum;
  });

  // Verify display ID order
  for (let i = 0; i < byDisplayId.length - 1; i++) {
    const current = parseInt(byDisplayId[i].displayExecutionId.split('-')[1], 10);
    const next = parseInt(byDisplayId[i + 1].displayExecutionId.split('-')[1], 10);
    assert.ok(current < next, 'Should be sorted by display ID');
  }
});
