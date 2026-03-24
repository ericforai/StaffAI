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
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    recommendedAgentRole: 'software-architect',
    routingStatus: 'matched',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
  };
}

test('store uses memory repositories when AGENCY_PERSISTENCE_MODE=memory', () => {
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
    store.saveTask(makeTask('task-memory-1'));

    assert.equal(store.getTasks().length, 1);
    assert.equal(store.getTaskById('task-memory-1')?.id, 'task-memory-1');
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

async function flushAsyncQueue() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test('store uses postgres repositories when AGENCY_PERSISTENCE_MODE=postgres', async () => {
  process.env.AGENCY_PERSISTENCE_MODE = 'postgres';
  process.env.AGENCY_POSTGRES_URL = 'postgres://placeholder';
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
    const store = new Store();
    store.saveTask(makeTask('task-postgres-1'));
    const task = store.getTaskById('task-postgres-1');
    await flushAsyncQueue();

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
