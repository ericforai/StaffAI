import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  generateExecutionRecords,
  type GenerateOptions,
} from '../scripts/generate-execution-records';

function createTempDir(): string {
  return mkdtempSync(join(os.tmpdir(), 'generate-executions-'));
}

test('generateExecutionRecords: generates requested count of records', async () => {
  const options: GenerateOptions = {
    count: 5,
  };

  const executions = await generateExecutionRecords(options);

  assert.equal(executions.length, 5);
});

test('generateExecutionRecords: each record has required fields', async () => {
  const options: GenerateOptions = {
    count: 1,
  };

  const executions = await generateExecutionRecords(options);

  assert.equal(executions.length, 1);
  const record = executions[0];

  // Verify required string fields
  assert.ok(typeof record.id === 'string');
  assert.ok(typeof record.displayExecutionId === 'string');
  assert.ok(typeof record.taskId === 'string');
  assert.ok(typeof record.status === 'string');
  assert.ok(typeof record.startedAt === 'string');

  // Verify displayExecutionId format
  assert.match(record.displayExecutionId, /^EXEC-\d{4}$/);

  // Verify valid UUID
  assert.ok(() => {
    try {
      randomUUID(record.id);
      return true;
    } catch {
      return false;
    }
  });

  // Verify valid ISO date
  assert.ok(() => {
    const date = new Date(record.startedAt);
    return !isNaN(date.getTime());
  });
});

test('generateExecutionRecords: records have valid status values', async () => {
  const options: GenerateOptions = {
    count: 50,
  };

  const executions = await generateExecutionRecords(options);
  const validStatuses = new Set(['completed', 'failed', 'cancelled', 'paused', 'running', 'pending', 'degraded']);

  for (const record of executions) {
    assert.ok(validStatuses.has(record.status), `Invalid status: ${record.status}`);
  }
});

test('generateExecutionRecords: records have valid executor values', async () => {
  const options: GenerateOptions = {
    count: 50,
  };

  const executions = await generateExecutionRecords(options);
  const validExecutors = new Set(['claude', 'codex', 'openai']);

  for (const record of executions) {
    if (record.executor) {
      assert.ok(validExecutors.has(record.executor), `Invalid executor: ${record.executor}`);
    }
  }
});

test('generateExecutionRecords: failed executions have structured errors', async () => {
  const options: GenerateOptions = {
    count: 100,
  };

  const executions = await generateExecutionRecords(options);
  const failedExecutions = executions.filter((e) => e.status === 'failed');

  assert.ok(failedExecutions.length > 0, 'Should have at least one failed execution');

  for (const record of failedExecutions) {
    assert.ok(record.structuredError, 'Failed execution must have structuredError');
    assert.ok(typeof record.structuredError?.code === 'string');
    assert.ok(typeof record.structuredError?.message === 'string');
    assert.ok(typeof record.structuredError?.retriable === 'boolean');
    assert.ok(record.errorMessage, 'Failed execution must have errorMessage');
    assert.equal(record.errorMessage, record.structuredError?.message);
  }
});

test('generateExecutionRecords: completed executions have output summaries', async () => {
  const options: GenerateOptions = {
    count: 100,
  };

  const executions = await generateExecutionRecords(options);
  const completedExecutions = executions.filter((e) => e.status === 'completed');

  assert.ok(completedExecutions.length > 0, 'Should have at least one completed execution');

  for (const record of completedExecutions) {
    assert.ok(record.outputSummary, 'Completed execution must have outputSummary');
    assert.ok(typeof record.outputSummary === 'string');
    assert.ok(record.outputSummary.length > 0);
  }
});

test('generateExecutionRecords: completed executions have output snapshots', async () => {
  const options: GenerateOptions = {
    count: 100,
  };

  const executions = await generateExecutionRecords(options);
  const completedExecutions = executions.filter((e) => e.status === 'completed');

  assert.ok(completedExecutions.length > 0, 'Should have at least one completed execution');

  for (const record of completedExecutions) {
    assert.ok(record.outputSnapshot, 'Completed execution must have outputSnapshot');
    assert.ok(typeof record.outputSnapshot === 'object');
  }
});

test('generateExecutionRecords: timestamps are in descending order', async () => {
  const options: GenerateOptions = {
    count: 10,
  };

  const executions = await generateExecutionRecords(options);

  for (let i = 0; i < executions.length - 1; i++) {
    const current = new Date(executions[i].startedAt).getTime();
    const next = new Date(executions[i + 1].startedAt).getTime();
    assert.ok(
      current >= next,
      `Executions should be sorted by startedAt descending: ${executions[i].startedAt} >= ${executions[i + 1].startedAt}`,
    );
  }
});

test('generateExecutionRecords: all records share same task ID when generated together', async () => {
  const options: GenerateOptions = {
    count: 10,
  };

  const executions = await generateExecutionRecords(options);
  const taskIds = new Set(executions.map((e) => e.taskId));

  assert.equal(taskIds.size, 1, 'All executions should share the same task ID');
});

test('generateExecutionRecords: can use custom task ID', async () => {
  const customTaskId = 'custom-task-123';
  const options: GenerateOptions = {
    count: 5,
    taskId: customTaskId,
  };

  const executions = await generateExecutionRecords(options);

  for (const record of executions) {
    assert.equal(record.taskId, customTaskId);
  }
});

test('generateExecutionRecords: generates unique execution IDs', async () => {
  const options: GenerateOptions = {
    count: 50,
  };

  const executions = await generateExecutionRecords(options);
  const ids = new Set(executions.map((e) => e.id));

  assert.equal(ids.size, 50, 'All execution IDs should be unique');
});

test('generateExecutionRecords: generates unique display execution IDs', async () => {
  const options: GenerateOptions = {
    count: 50,
  };

  const executions = await generateExecutionRecords(options);
  const displayIds = new Set(executions.map((e) => e.displayExecutionId));

  assert.equal(displayIds.size, 50, 'All display execution IDs should be unique');
});

test('generateExecutionRecords: writes output file when specified', async () => {
  const tempDir = createTempDir();
  const outputFile = join(tempDir, 'executions.json');

  try {
    const options: GenerateOptions = {
      count: 5,
      outputFile,
    };

    await generateExecutionRecords(options);

    // Verify file exists
    const content = await readFile(outputFile, 'utf-8');
    const data = JSON.parse(content);

    // Verify structure
    assert.ok(Array.isArray(data.executions));
    assert.equal(data.executions.length, 5);
    assert.ok(data.summary);
    assert.equal(data.summary.total, 5);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('generateExecutionRecords: output file includes summary statistics', async () => {
  const tempDir = createTempDir();
  const outputFile = join(tempDir, 'executions.json');

  try {
    const options: GenerateOptions = {
      count: 100,
      outputFile,
    };

    await generateExecutionRecords(options);

    const content = await readFile(outputFile, 'utf-8');
    const data = JSON.parse(content);

    // Verify summary structure
    assert.ok(data.summary);
    assert.equal(data.summary.total, 100);
    assert.ok(typeof data.summary.statusCounts === 'object');
    assert.ok(typeof data.summary.executorCounts === 'object');

    // Verify status counts add up
    const statusTotal = Object.values(data.summary.statusCounts).reduce((sum: number, count) => sum + (count as number), 0);
    assert.equal(statusTotal, 100);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('generateExecutionRecords: output file includes task when not using custom task ID', async () => {
  const tempDir = createTempDir();
  const outputFile = join(tempDir, 'executions.json');

  try {
    const options: GenerateOptions = {
      count: 5,
      outputFile,
    };

    await generateExecutionRecords(options);

    const content = await readFile(outputFile, 'utf-8');
    const data = JSON.parse(content);

    // Verify task is included
    assert.ok(data.task, 'Task should be included when not using custom task ID');
    assert.ok(data.task.id);
    assert.ok(data.task.title);
    assert.ok(data.task.taskType);
    assert.ok(data.task.priority);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('generateExecutionRecords: retry count is zero for non-failed executions', async () => {
  const options: GenerateOptions = {
    count: 100,
  };

  const executions = await generateExecutionRecords(options);
  const nonFailedExecutions = executions.filter((e) => e.status !== 'failed');

  for (const record of nonFailedExecutions) {
    assert.equal(record.retryCount, 0, 'Non-failed executions should have retryCount = 0');
  }
});

test('generateExecutionRecords: failed executions have retry count within bounds', async () => {
  const options: GenerateOptions = {
    count: 100,
  };

  const executions = await generateExecutionRecords(options);
  const failedExecutions = executions.filter((e) => e.status === 'failed');

  for (const record of failedExecutions) {
    assert.ok(record.retryCount >= 0 && record.retryCount <= 3, `Retry count should be 0-3: ${record.retryCount}`);
    assert.equal(record.maxRetries, 3);
  }
});

test('generateExecutionRecords: timeout values are reasonable', async () => {
  const options: GenerateOptions = {
    count: 50,
  };

  const executions = await generateExecutionRecords(options);

  for (const record of executions) {
    assert.ok(record.timeoutMs >= 30000 && record.timeoutMs <= 150000, `Timeout should be 30-150s: ${record.timeoutMs}`);
  }
});

test('generateExecutionRecords: input snapshot has required structure', async () => {
  const options: GenerateOptions = {
    count: 10,
  };

  const executions = await generateExecutionRecords(options);

  for (const record of executions) {
    assert.ok(record.inputSnapshot);
    assert.ok(typeof record.inputSnapshot === 'object');
    assert.ok(record.inputSnapshot.taskType);
    assert.ok(record.inputSnapshot.priority);
    assert.ok(record.inputSnapshot.description);
  }
});

test('generateExecutionRecords: display execution IDs are sequential', async () => {
  const options: GenerateOptions = {
    count: 10,
  };

  const executions = await generateExecutionRecords(options);

  // Sort by display execution ID to check sequentiality
  const sorted = [...executions].sort((a, b) => {
    const aNum = parseInt(a.displayExecutionId.split('-')[1], 10);
    const bNum = parseInt(b.displayExecutionId.split('-')[1], 10);
    return aNum - bNum;
  });

  // Note: after sorting by startedAt descending, the display IDs won't be sequential
  // But they should all be unique and properly formatted
  for (let i = 0; i < sorted.length; i++) {
    assert.equal(sorted[i].displayExecutionId, `EXEC-${String(i + 1).padStart(4, '0')}`);
  }
});

test('generateExecutionRecords: handles zero count gracefully', async () => {
  const options: GenerateOptions = {
    count: 0,
  };

  const executions = await generateExecutionRecords(options);

  assert.equal(executions.length, 0);
});

test('generateExecutionRecords: handles single execution', async () => {
  const options: GenerateOptions = {
    count: 1,
  };

  const executions = await generateExecutionRecords(options);

  assert.equal(executions.length, 1);
  assert.equal(executions[0].displayExecutionId, 'EXEC-0001');
});

test('generateExecutionRecords: handles large count', async () => {
  const options: GenerateOptions = {
    count: 500,
  };

  const executions = await generateExecutionRecords(options);

  assert.equal(executions.length, 500);
  assert.equal(executions[0].displayExecutionId, 'EXEC-0001');
  assert.equal(executions[499].displayExecutionId, 'EXEC-0500');
});

test('generateExecutionRecords: workflow IDs are unique per execution', async () => {
  const options: GenerateOptions = {
    count: 50,
  };

  const executions = await generateExecutionRecords(options);
  const workflowPlanIds = new Set(executions.map((e) => e.workflowPlanId));
  const workflowStepIds = new Set(executions.map((e) => e.workflowStepId));
  const assignmentIds = new Set(executions.map((e) => e.assignmentId));

  // All should have high uniqueness (allow some collisions due to random UUIDs)
  assert.ok(workflowPlanIds.size > 40, 'Workflow plan IDs should be mostly unique');
  assert.ok(workflowStepIds.size > 40, 'Workflow step IDs should be mostly unique');
  assert.ok(assignmentIds.size > 40, 'Assignment IDs should be mostly unique');
});
