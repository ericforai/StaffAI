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

function createSqlStateMock() {
  const rowsByTable = new Map<string, Map<string, Record<string, unknown>>>();

  function getTableStore(tableName: string) {
    let table = rowsByTable.get(tableName);
    if (!table) {
      table = new Map<string, Record<string, unknown>>();
      rowsByTable.set(tableName, table);
    }
    return table;
  }

  return async function queryMock(...args: unknown[]) {
    const queryText = typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string })?.text ?? '');
    const values = Array.isArray(args[1]) ? (args[1] as unknown[]) : [];

    const insertMatch = queryText.match(/INSERT INTO ("[^"]+"\."[^"]+")/);
    if (insertMatch) {
      const table = getTableStore(insertMatch[1]);
      const id = String(values[0]);
      const payload = JSON.parse(String(values[1])) as Record<string, unknown>;
      table.set(id, payload);
      return { rows: [], rowCount: 1 };
    }

    const byIdMatch = queryText.match(/SELECT payload FROM ("[^"]+"\."[^"]+") WHERE id = \$1 LIMIT 1/);
    if (byIdMatch) {
      const table = getTableStore(byIdMatch[1]);
      const payload = table.get(String(values[0]));
      return { rows: payload ? [{ payload }] : [], rowCount: payload ? 1 : 0 };
    }

    const byTaskIdMatch = queryText.match(/SELECT payload FROM ("[^"]+"\."[^"]+") WHERE payload->>'taskId' = \$1/);
    if (byTaskIdMatch) {
      const table = getTableStore(byTaskIdMatch[1]);
      const taskId = String(values[0]);
      const rows = Array.from(table.values())
        .filter((payload) => String(payload.taskId) === taskId)
        .map((payload) => ({ payload }));
      return { rows, rowCount: rows.length };
    }

    const listMatch = queryText.match(/SELECT payload FROM ("[^"]+"\."[^"]+") ORDER BY updated_at ASC/);
    if (listMatch) {
      const table = getTableStore(listMatch[1]);
      const rows = Array.from(table.values()).map((payload) => ({ payload }));
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  };
}

test('postgres task repository persists through SQL statements and keeps API compatibility', async () => {
  const executedSql: string[] = [];
  const originalQuery = Pool.prototype.query;
  const sqlStateMock = createSqlStateMock();
  (Pool.prototype as unknown as {
    query: (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
  }).query = async function queryMock(...args: unknown[]) {
    const queryText = typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string })?.text ?? '');
    executedSql.push(queryText);
    return sqlStateMock(...args);
  };

  try {
    const repository = createPostgresTaskRepository(options);
    await repository.save({
      id: 'task-1',
      title: 'title',
      description: 'description',
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
    });
    const updated = await repository.update('task-1', (task) => ({
      ...task,
      status: 'completed',
      updatedAt: '2026-03-24T01:00:00.000Z',
    }));
    const list = await repository.list();
    await repository.getById('task-missing');

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
  const sqlStateMock = createSqlStateMock();
  (Pool.prototype as unknown as {
    query: (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
  }).query = async function queryMock(...args: unknown[]) {
    const queryText = typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string })?.text ?? '');
    executedSql.push(queryText);
    return sqlStateMock(...args);
  };

  try {
    const approvalRepository = createPostgresApprovalRepository(options);
    const executionRepository = createPostgresExecutionRepository(options);

    await approvalRepository.save({
      id: 'approval-1',
      taskId: 'task-1',
      status: 'pending',
      requestedBy: 'system',
      requestedAt: '2026-03-24T00:00:00.000Z',
    });
    const approved = await approvalRepository.updateStatus('approval-1', 'approved');
    await approvalRepository.listByTaskId('task-1');

    await executionRepository.save({
      id: 'execution-1',
      taskId: 'task-1',
      status: 'pending',
      executor: 'codex',
    });
    const execution = await executionRepository.update('execution-1', (current) => ({
      ...current,
      status: 'completed',
      outputSummary: 'done',
    }));
    await executionRepository.listByTaskId('task-1');
    await executionRepository.getById('execution-missing');

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
