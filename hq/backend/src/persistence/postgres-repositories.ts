import { Pool, type PoolConfig } from 'pg';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';
import type { ApprovalRepository, ExecutionRepository, TaskRepository } from './file-repositories';

interface QueryResultRow<TPayload> {
  payload: TPayload;
}

interface PgClientLike {
  query<TResult = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: TResult[]; rowCount: number | null }>;
}

interface QueueLike {
  enqueue(operation: () => Promise<void>): void;
}

interface PgRuntime {
  client: PgClientLike;
  schema: string;
  taskTable: string;
  approvalTable: string;
  executionTable: string;
}

export interface PostgresPersistenceOptions {
  connectionString: string;
  schema?: string;
  taskTable?: string;
  approvalTable?: string;
  executionTable?: string;
  poolMax?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  ssl?: PoolConfig['ssl'];
}

const SHARED_POOLS = new Map<string, Pool>();

function cloneRecord<T>(record: T): T {
  return JSON.parse(JSON.stringify(record)) as T;
}

function parseInteger(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? undefined : value;
}

function parseSslSetting(raw: string | undefined): PoolConfig['ssl'] | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'require') {
    return { rejectUnauthorized: false };
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'disable') {
    return false;
  }
  return undefined;
}

function normalizeIdentifier(identifier: string, label: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid postgres identifier for ${label}: ${identifier}`);
  }
  return identifier;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier}"`;
}

function qualifyTable(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function getPoolKey(options: PostgresPersistenceOptions, ssl: PoolConfig['ssl'] | undefined): string {
  const sslKey =
    typeof ssl === 'object' && ssl !== null ? JSON.stringify({ rejectUnauthorized: ssl.rejectUnauthorized }) : String(ssl);
  return [
    options.connectionString,
    options.poolMax ?? parseInteger(process.env.AGENCY_POSTGRES_POOL_MAX),
    options.idleTimeoutMs ?? parseInteger(process.env.AGENCY_POSTGRES_IDLE_TIMEOUT_MS),
    options.connectionTimeoutMs ?? parseInteger(process.env.AGENCY_POSTGRES_CONNECTION_TIMEOUT_MS),
    sslKey,
  ].join('|');
}

function resolveRuntime(options: PostgresPersistenceOptions): PgRuntime {
  const schema = normalizeIdentifier(options.schema ?? process.env.AGENCY_POSTGRES_SCHEMA ?? 'public', 'schema');
  const taskTable = normalizeIdentifier(
    options.taskTable ?? process.env.AGENCY_POSTGRES_TASKS_TABLE ?? 'tasks',
    'task table'
  );
  const approvalTable = normalizeIdentifier(
    options.approvalTable ?? process.env.AGENCY_POSTGRES_APPROVALS_TABLE ?? 'approvals',
    'approval table'
  );
  const executionTable = normalizeIdentifier(
    options.executionTable ?? process.env.AGENCY_POSTGRES_EXECUTIONS_TABLE ?? 'executions',
    'execution table'
  );
  const ssl = options.ssl ?? parseSslSetting(process.env.AGENCY_POSTGRES_SSL);
  const poolKey = getPoolKey(options, ssl);

  const existingPool = SHARED_POOLS.get(poolKey);
  if (existingPool) {
    return { client: existingPool, schema, taskTable, approvalTable, executionTable };
  }

  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.poolMax ?? parseInteger(process.env.AGENCY_POSTGRES_POOL_MAX),
    idleTimeoutMillis: options.idleTimeoutMs ?? parseInteger(process.env.AGENCY_POSTGRES_IDLE_TIMEOUT_MS),
    connectionTimeoutMillis: options.connectionTimeoutMs ?? parseInteger(process.env.AGENCY_POSTGRES_CONNECTION_TIMEOUT_MS),
    ssl,
  });

  SHARED_POOLS.set(poolKey, pool);
  return { client: pool, schema, taskTable, approvalTable, executionTable };
}

function createQueue(client: PgClientLike, label: string): QueueLike {
  let chain = Promise.resolve<void>(undefined);
  return {
    enqueue(operation) {
      chain = chain
        .then(operation)
        .catch((error) => {
          console.error(`[postgres-repositories] ${label} query failed`, error);
        });
    },
  };
}

function scheduleRefreshAll<TRecord extends { id: string }>(
  queue: QueueLike,
  client: PgClientLike,
  tableName: string,
  cache: Map<string, TRecord>
) {
  queue.enqueue(async () => {
    const result = await client.query<QueryResultRow<TRecord>>(
      `SELECT payload FROM ${tableName} ORDER BY updated_at ASC`
    );
    cache.clear();
    for (const row of result.rows) {
      cache.set(row.payload.id, cloneRecord(row.payload));
    }
  });
}

function scheduleRefreshById<TRecord extends { id: string }>(
  queue: QueueLike,
  client: PgClientLike,
  tableName: string,
  cache: Map<string, TRecord>,
  id: string
) {
  queue.enqueue(async () => {
    const result = await client.query<QueryResultRow<TRecord>>(
      `SELECT payload FROM ${tableName} WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) {
      cache.delete(id);
      return;
    }
    cache.set(id, cloneRecord(result.rows[0].payload));
  });
}

function scheduleRefreshByTaskId<TRecord extends { id: string; taskId: string }>(
  queue: QueueLike,
  client: PgClientLike,
  tableName: string,
  cache: Map<string, TRecord>,
  taskId: string
) {
  queue.enqueue(async () => {
    const result = await client.query<QueryResultRow<TRecord>>(
      `SELECT payload FROM ${tableName} WHERE payload->>'taskId' = $1 ORDER BY updated_at ASC`,
      [taskId]
    );
    for (const row of result.rows) {
      cache.set(row.payload.id, cloneRecord(row.payload));
    }
  });
}

function scheduleUpsert<TRecord extends { id: string }>(
  queue: QueueLike,
  client: PgClientLike,
  tableName: string,
  record: TRecord
) {
  const payload = JSON.stringify(record);
  queue.enqueue(async () => {
    await client.query(
      `INSERT INTO ${tableName} (id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [record.id, payload]
    );
  });
}

function scheduleBootstrap(
  queue: QueueLike,
  client: PgClientLike,
  tableName: string,
  tableLabel: string,
  includesTaskLookupIndex: boolean
) {
  queue.enqueue(async () => {
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    if (includesTaskLookupIndex) {
      await client.query(
        `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableLabel}_task_id_idx`)}
         ON ${tableName} ((payload->>'taskId'))`
      );
    }
  });
}

function createInitializer<TRecord extends { id: string }>(
  queue: QueueLike,
  client: PgClientLike,
  tableName: string,
  tableLabel: string,
  cache: Map<string, TRecord>,
  includesTaskLookupIndex: boolean
) {
  let initialized = false;
  return () => {
    if (initialized) return;
    initialized = true;
    scheduleBootstrap(queue, client, tableName, tableLabel, includesTaskLookupIndex);
    scheduleRefreshAll(queue, client, tableName, cache);
  };
}

export function createPostgresTaskRepository(options: PostgresPersistenceOptions): TaskRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.taskTable);
  const cache = new Map<string, TaskRecord>();
  const queue = createQueue(runtime.client, runtime.taskTable);
  const initialize = createInitializer(queue, runtime.client, tableName, runtime.taskTable, cache, false);

  return {
    list() {
      initialize();
      scheduleRefreshAll(queue, runtime.client, tableName, cache);
      return Array.from(cache.values()).map((task) => cloneRecord(task));
    },
    getById(taskId) {
      initialize();
      const found = cache.get(taskId);
      if (!found) {
        scheduleRefreshById(queue, runtime.client, tableName, cache, taskId);
      }
      return found ? cloneRecord(found) : null;
    },
    save(task) {
      initialize();
      cache.set(task.id, cloneRecord(task));
      scheduleUpsert(queue, runtime.client, tableName, task);
    },
    update(taskId, updater) {
      initialize();
      const current = cache.get(taskId);
      if (!current) {
        scheduleRefreshById(queue, runtime.client, tableName, cache, taskId);
        return null;
      }
      const updated = updater(cloneRecord(current));
      cache.set(taskId, cloneRecord(updated));
      scheduleUpsert(queue, runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresApprovalRepository(options: PostgresPersistenceOptions): ApprovalRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.approvalTable);
  const cache = new Map<string, ApprovalRecord>();
  const queue = createQueue(runtime.client, runtime.approvalTable);
  const initialize = createInitializer(queue, runtime.client, tableName, runtime.approvalTable, cache, true);

  return {
    list() {
      initialize();
      scheduleRefreshAll(queue, runtime.client, tableName, cache);
      return Array.from(cache.values()).map((approval) => cloneRecord(approval));
    },
    listByTaskId(taskId) {
      initialize();
      scheduleRefreshByTaskId(queue, runtime.client, tableName, cache, taskId);
      return Array.from(cache.values())
        .filter((approval) => approval.taskId === taskId)
        .map((approval) => cloneRecord(approval));
    },
    save(approval) {
      initialize();
      cache.set(approval.id, cloneRecord(approval));
      scheduleUpsert(queue, runtime.client, tableName, approval);
    },
    updateStatus(approvalId, status) {
      initialize();
      const current = cache.get(approvalId);
      if (!current) {
        scheduleRefreshById(queue, runtime.client, tableName, cache, approvalId);
        return null;
      }
      const updated: ApprovalRecord = {
        ...cloneRecord(current),
        status,
        resolvedAt: new Date().toISOString(),
      };
      cache.set(approvalId, cloneRecord(updated));
      scheduleUpsert(queue, runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresExecutionRepository(options: PostgresPersistenceOptions): ExecutionRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.executionTable);
  const cache = new Map<string, ExecutionRecord>();
  const queue = createQueue(runtime.client, runtime.executionTable);
  const initialize = createInitializer(queue, runtime.client, tableName, runtime.executionTable, cache, true);

  return {
    list() {
      initialize();
      scheduleRefreshAll(queue, runtime.client, tableName, cache);
      return Array.from(cache.values()).map((execution) => cloneRecord(execution));
    },
    getById(executionId) {
      initialize();
      const found = cache.get(executionId);
      if (!found) {
        scheduleRefreshById(queue, runtime.client, tableName, cache, executionId);
      }
      return found ? cloneRecord(found) : null;
    },
    listByTaskId(taskId) {
      initialize();
      scheduleRefreshByTaskId(queue, runtime.client, tableName, cache, taskId);
      return Array.from(cache.values())
        .filter((execution) => execution.taskId === taskId)
        .map((execution) => cloneRecord(execution));
    },
    save(execution) {
      initialize();
      cache.set(execution.id, cloneRecord(execution));
      scheduleUpsert(queue, runtime.client, tableName, execution);
    },
    update(executionId, updater) {
      initialize();
      const current = cache.get(executionId);
      if (!current) {
        scheduleRefreshById(queue, runtime.client, tableName, cache, executionId);
        return null;
      }
      const updated = updater(cloneRecord(current));
      cache.set(executionId, cloneRecord(updated));
      scheduleUpsert(queue, runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}
