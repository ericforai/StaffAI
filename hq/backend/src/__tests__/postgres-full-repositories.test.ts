import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import {
  createPostgresTaskAssignmentRepository,
  createPostgresWorkflowPlanRepository,
  createPostgresToolCallLogRepository,
} from '../persistence/postgres-repositories';
import { createPostgresAuditLogRepository } from '../persistence/audit-log-repositories';
import { createPostgresKnowledgeAdapter } from '../persistence/postgres-knowledge-adapter';

const options = {
  connectionString: 'postgres://placeholder',
  schema: 'public',
};

function createSqlStateMock() {
  const rowsByTable = new Map<string, Map<string, Record<string, unknown>>>();

  function extractPayload(values: unknown[]): Record<string, unknown> {
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const candidate = values[index];
      if (typeof candidate !== 'string') {
        continue;
      }
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch {
        continue;
      }
    }

    throw new Error('Expected JSON payload in SQL values');
  }

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

    // Normalize table name from query (strip quotes if necessary for mapping)
    const tableMatch = queryText.match(/(?:INSERT INTO|FROM|UPDATE) ("[^"]+"\."[^"]+")/);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';

    if (queryText.includes('INSERT INTO')) {
      const table = getTableStore(tableName);
      const id = String(values[0]);
      const payload = extractPayload(values);
      table.set(id, payload);
      return { rows: [], rowCount: 1 };
    }

    if (queryText.includes('SELECT payload FROM') && queryText.includes('WHERE id = $1')) {
      const table = getTableStore(tableName);
      const payload = table.get(String(values[0]));
      return { rows: payload ? [{ payload }] : [], rowCount: payload ? 1 : 0 };
    }

    if (queryText.includes('SELECT payload FROM') && queryText.includes('WHERE payload->>\'taskId\' = $1')) {
      const table = getTableStore(tableName);
      const taskId = String(values[0]);
      const rows = Array.from(table.values())
        .filter((payload) => String(payload.taskId) === taskId)
        .map((payload) => ({ payload }));
      return { rows, rowCount: rows.length };
    }

    if (queryText.includes('SELECT payload FROM') && queryText.includes('WHERE payload->>\'executionId\' = $1')) {
      const table = getTableStore(tableName);
      const executionId = String(values[0]);
      const rows = Array.from(table.values())
        .filter((payload) => String(payload.executionId) === executionId)
        .map((payload) => ({ payload }));
      return { rows, rowCount: rows.length };
    }

    if (queryText.includes('SELECT payload FROM') && queryText.includes('WHERE entity_id = $1')) {
      const table = getTableStore(tableName);
      const entityId = String(values[0]);
      const rows = Array.from(table.values())
        .filter((payload) => String(payload.entityId) === entityId)
        .map((payload) => ({ payload }));
      return { rows, rowCount: rows.length };
    }

    if (queryText.includes('SELECT payload FROM') && !queryText.includes('WHERE')) {
      const table = getTableStore(tableName);
      const rows = Array.from(table.values()).map((payload) => ({ payload }));
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  };
}

test('postgres operational repositories (assignments, plans, tool logs) work correctly', async () => {
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
    const assignmentRepo = createPostgresTaskAssignmentRepository(options);
    const planRepo = createPostgresWorkflowPlanRepository(options);
    const toolLogRepo = createPostgresToolCallLogRepository(options);

    // Test Assignments
    await assignmentRepo.save({
      id: 'assign-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      assignmentRole: 'primary',
      status: 'pending',
    });
    const assignments = await assignmentRepo.listByTaskId('task-1');
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].id, 'assign-1');

    // Test Workflow Plans
    await planRepo.save({
      id: 'plan-1',
      taskId: 'task-1',
      mode: 'serial',
      synthesisRequired: false,
      steps: [],
    });
    const plan = await planRepo.getByTaskId('task-1');
    assert.equal(plan?.id, 'plan-1');

    // Test Tool Call Logs
    await toolLogRepo.save({
      id: 'log-1',
      toolName: 'read_file',
      actorRole: 'primary',
      riskLevel: 'low',
      taskId: 'task-1',
      executionId: 'exec-1',
      status: 'completed',
      createdAt: new Date().toISOString(),
    });
    const logsByTask = await toolLogRepo.listByTaskId('task-1');
    const logsByExec = await toolLogRepo.listByExecutionId('exec-1');
    assert.equal(logsByTask.length, 1);
    assert.equal(logsByExec.length, 1);
    assert.equal(logsByTask[0].id, 'log-1');

    assert.equal(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS "public"."task_assignments"')), true);
    assert.equal(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS "public"."workflow_plans"')), true);
    assert.equal(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS "public"."tool_call_logs"')), true);
  } finally {
    (Pool.prototype as unknown as { query: typeof originalQuery }).query = originalQuery;
  }
});

test('postgres audit log repository works correctly', async () => {
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
    const auditRepo = createPostgresAuditLogRepository(options);
    await auditRepo.save({
      id: 'audit-1',
      entityType: 'task',
      entityId: 'task-1',
      action: 'created',
      actor: 'user',
      timestamp: new Date().toISOString(),
    });

    const logs = await auditRepo.getByEntityId('task-1');
    assert.equal(logs.length, 1);
    assert.equal(logs[0].id, 'audit-1');
    assert.equal(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS "public"."audit_logs"')), true);
  } finally {
    (Pool.prototype as unknown as { query: typeof originalQuery }).query = originalQuery;
  }
});

test('postgres knowledge adapter works correctly', async () => {
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
    const adapter = createPostgresKnowledgeAdapter(options);
    await adapter.save({
      task: 'research postgres',
      agentId: 'agent-1',
      resultSummary: 'found everything',
      timestamp: Date.now(),
    });

    const results = await adapter.search('postgres');
    assert.equal(results.length, 1);
    assert.equal(results[0].task, 'research postgres');
    assert.equal(executedSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS "public"."knowledge_base"')), true);
  } finally {
    (Pool.prototype as unknown as { query: typeof originalQuery }).query = originalQuery;
  }
});
