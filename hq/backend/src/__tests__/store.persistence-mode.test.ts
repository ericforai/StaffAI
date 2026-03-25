import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import type { TaskRecord } from '../shared/task-types';
import { Store } from '../store';

const originalMode = process.env.AGENCY_PERSISTENCE_MODE;
const originalTasksFile = process.env.AGENCY_TASKS_FILE;
const originalApprovalsFile = process.env.AGENCY_APPROVALS_FILE;
const originalExecutionsFile = process.env.AGENCY_EXECUTIONS_FILE;

function makeTask(id: string): TaskRecord {
  return {
    id,
    title: 'Memory mode task',
    description: 'Stored in memory repositories',
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
  };
}

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

    return { rows: [], rowCount: 0 };
  };
}

test('store uses memory repositories when AGENCY_PERSISTENCE_MODE=memory', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-memory-mode-'));
  const tasksFile = path.join(tempDir, 'tasks.json');
  const approvalsFile = path.join(tempDir, 'approvals.json');
  const executionsFile = path.join(tempDir, 'executions.json');

  process.env.AGENCY_PERSISTENCE_MODE = 'memory';
  process.env.AGENCY_TASKS_FILE = tasksFile;
  process.env.AGENCY_APPROVALS_FILE = approvalsFile;
  process.env.AGENCY_EXECUTIONS_FILE = executionsFile;

  try {
    const store = new Store();
    await store.saveTask(makeTask('task-memory-1'));

    assert.equal((await store.getTasks()).length, 1);
    assert.equal((await store.getTaskById('task-memory-1'))?.id, 'task-memory-1');
    assert.equal(fs.existsSync(tasksFile), false);
    assert.equal(fs.existsSync(approvalsFile), false);
    assert.equal(fs.existsSync(executionsFile), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalMode === undefined) {
      delete process.env.AGENCY_PERSISTENCE_MODE;
    } else {
      process.env.AGENCY_PERSISTENCE_MODE = originalMode;
    }
    if (originalTasksFile === undefined) {
      delete process.env.AGENCY_TASKS_FILE;
    } else {
      process.env.AGENCY_TASKS_FILE = originalTasksFile;
    }
    if (originalApprovalsFile === undefined) {
      delete process.env.AGENCY_APPROVALS_FILE;
    } else {
      process.env.AGENCY_APPROVALS_FILE = originalApprovalsFile;
    }
    if (originalExecutionsFile === undefined) {
      delete process.env.AGENCY_EXECUTIONS_FILE;
    } else {
      process.env.AGENCY_EXECUTIONS_FILE = originalExecutionsFile;
    }
  }
});

test('store uses postgres repositories when AGENCY_PERSISTENCE_MODE=postgres', async () => {
  process.env.AGENCY_PERSISTENCE_MODE = 'postgres';
  process.env.AGENCY_POSTGRES_URL = 'postgres://placeholder';
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
    const store = new Store();
    await store.saveTask(makeTask('task-postgres-1'));
    const task = await store.getTaskById('task-postgres-1');

    assert.equal(task?.id, 'task-postgres-1');
    assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "public"."tasks"')), true);
    assert.equal(executedSql.some((sql) => sql.includes('INSERT INTO "public"."tasks"')), true);
  } finally {
    (Pool.prototype as unknown as { query: typeof originalQuery }).query = originalQuery;
    if (originalMode === undefined) {
      delete process.env.AGENCY_PERSISTENCE_MODE;
    } else {
      process.env.AGENCY_PERSISTENCE_MODE = originalMode;
    }
    delete process.env.AGENCY_POSTGRES_URL;
  }
});
