import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import {
  createPostgresApprovalRepository,
  createPostgresExecutionRepository,
  createPostgresTaskRepository,
} from '../persistence/postgres-repositories';

const options = {
  connectionString: 'postgres://placeholder',
  schema: 'public',
};

async function flushAsyncQueue() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test('postgres task repository persists through SQL statements and keeps API compatibility', async () => {
  const executedSql: string[] = [];
  const originalQuery = Pool.prototype.query;
  (Pool.prototype as unknown as {
    query: (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
  }).query = async function queryMock(...args: unknown[]) {
    const queryText = typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string })?.text ?? '');
    executedSql.push(queryText);
    return { rows: [], rowCount: 0 };
  };

  try {
    const repository = createPostgresTaskRepository(options);
    repository.save({
      id: 'task-1',
      title: 'title',
      description: 'description',
      status: 'created',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      recommendedAgentRole: 'software-architect',
      routingStatus: 'matched',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
    });
    const updated = repository.update('task-1', (task) => ({
      ...task,
      status: 'completed',
      updatedAt: '2026-03-24T01:00:00.000Z',
    }));
    const list = repository.list();
    repository.getById('task-missing');

    await flushAsyncQueue();

    assert.equal(updated?.status, 'completed');
    assert.equal(list.length, 1);
    assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "public"."tasks"')), true);
    assert.equal(executedSql.some((sql) => sql.includes('INSERT INTO "public"."tasks"')), true);
    assert.equal(
      executedSql.some((sql) => sql.includes('SELECT payload FROM "public"."tasks" WHERE id = $1 LIMIT 1')),
      true
    );
  } finally {
    (Pool.prototype as unknown as { query: typeof originalQuery }).query = originalQuery;
  }
});

test('postgres approval and execution repositories issue SQL for scoped reads and updates', async () => {
  const executedSql: string[] = [];
  const originalQuery = Pool.prototype.query;
  (Pool.prototype as unknown as {
    query: (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
  }).query = async function queryMock(...args: unknown[]) {
    const queryText = typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string })?.text ?? '');
    executedSql.push(queryText);
    return { rows: [], rowCount: 0 };
  };

  try {
    const approvalRepository = createPostgresApprovalRepository(options);
    const executionRepository = createPostgresExecutionRepository(options);

    approvalRepository.save({
      id: 'approval-1',
      taskId: 'task-1',
      status: 'pending',
      requestedBy: 'system',
      requestedAt: '2026-03-24T00:00:00.000Z',
    });
    const approved = approvalRepository.updateStatus('approval-1', 'approved');
    approvalRepository.listByTaskId('task-1');

    executionRepository.save({
      id: 'execution-1',
      taskId: 'task-1',
      status: 'pending',
      executor: 'codex',
    });
    const execution = executionRepository.update('execution-1', (current) => ({
      ...current,
      status: 'completed',
      outputSummary: 'done',
    }));
    executionRepository.listByTaskId('task-1');
    executionRepository.getById('execution-missing');

    await flushAsyncQueue();

    assert.equal(approved?.status, 'approved');
    assert.equal(typeof approved?.resolvedAt, 'string');
    assert.equal(execution?.status, 'completed');
    assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "public"."approvals"')), true);
    assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "public"."executions"')), true);
    assert.equal(
      executedSql.some((sql) => sql.includes('SELECT payload FROM "public"."approvals" WHERE payload->>\'taskId\' = $1')),
      true
    );
    assert.equal(
      executedSql.some((sql) => sql.includes('SELECT payload FROM "public"."executions" WHERE payload->>\'taskId\' = $1')),
      true
    );
    assert.equal(executedSql.some((sql) => sql.includes('INSERT INTO "public"."approvals"')), true);
    assert.equal(executedSql.some((sql) => sql.includes('INSERT INTO "public"."executions"')), true);
  } finally {
    (Pool.prototype as unknown as { query: typeof originalQuery }).query = originalQuery;
  }
});
