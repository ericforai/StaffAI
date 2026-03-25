import { Pool, type PoolConfig } from 'pg';
import type { ApprovalRecord, ExecutionRecord, TaskAssignment, TaskRecord, ToolCallLog, WorkflowPlan } from '../shared/task-types';
import type {
  ApprovalRepository,
  ExecutionRepository,
  TaskAssignmentRepository,
  TaskRepository,
  ToolCallLogRepository,
  WorkflowPlanRepository,
} from './file-repositories';

interface QueryResultRow<TPayload> {
  payload: TPayload;
}

interface PgClientLike {
  query<TResult = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: TResult[]; rowCount: number | null }>;
}

interface PgRuntime {
  client: PgClientLike;
  schema: string;
  taskTable: string;
  approvalTable: string;
  executionTable: string;
  taskAssignmentTable: string;
  workflowPlanTable: string;
  toolCallLogTable: string;
}

export interface PostgresPersistenceOptions {
  connectionString: string;
  schema?: string;
  taskTable?: string;
  approvalTable?: string;
  executionTable?: string;
  taskAssignmentTable?: string;
  workflowPlanTable?: string;
  toolCallLogTable?: string;
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
  const taskAssignmentTable = normalizeIdentifier(
    options.taskAssignmentTable ?? process.env.AGENCY_POSTGRES_TASK_ASSIGNMENTS_TABLE ?? 'task_assignments',
    'task assignment table'
  );
  const workflowPlanTable = normalizeIdentifier(
    options.workflowPlanTable ?? process.env.AGENCY_POSTGRES_WORKFLOW_PLANS_TABLE ?? 'workflow_plans',
    'workflow plan table'
  );
  const toolCallLogTable = normalizeIdentifier(
    options.toolCallLogTable ?? process.env.AGENCY_POSTGRES_TOOL_CALL_LOGS_TABLE ?? 'tool_call_logs',
    'tool call log table'
  );
  const ssl = options.ssl ?? parseSslSetting(process.env.AGENCY_POSTGRES_SSL);
  const poolKey = getPoolKey(options, ssl);

  const existingPool = SHARED_POOLS.get(poolKey);
  if (existingPool) {
    return {
      client: existingPool,
      schema,
      taskTable,
      approvalTable,
      executionTable,
      taskAssignmentTable,
      workflowPlanTable,
      toolCallLogTable,
    };
  }

  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.poolMax ?? parseInteger(process.env.AGENCY_POSTGRES_POOL_MAX),
    idleTimeoutMillis: options.idleTimeoutMs ?? parseInteger(process.env.AGENCY_POSTGRES_IDLE_TIMEOUT_MS),
    connectionTimeoutMillis: options.connectionTimeoutMs ?? parseInteger(process.env.AGENCY_POSTGRES_CONNECTION_TIMEOUT_MS),
    allowExitOnIdle: true,
    ssl,
  });

  SHARED_POOLS.set(poolKey, pool);
  return {
    client: pool,
    schema,
    taskTable,
    approvalTable,
    executionTable,
    taskAssignmentTable,
    workflowPlanTable,
    toolCallLogTable,
  };
}

function createBootstrapper(
  client: PgClientLike,
  tableName: string,
  tableLabel: string,
  lookupFields: string[] = []
): () => Promise<void> {
  let bootstrapPromise: Promise<void> | null = null;

  return async () => {
    if (!bootstrapPromise) {
      bootstrapPromise = (async () => {
        await client.query(
          `CREATE TABLE IF NOT EXISTS ${tableName} (
            id TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`
        );
        for (const field of lookupFields) {
          await client.query(
            `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableLabel}_${field}_idx`)}
             ON ${tableName} ((payload->>'${field}'))`
          );
        }
      })();
    }

    await bootstrapPromise;
  };
}

async function listRecords<TRecord>(client: PgClientLike, tableName: string): Promise<TRecord[]> {
  const result = await client.query<QueryResultRow<TRecord>>(
    `SELECT payload FROM ${tableName} ORDER BY updated_at ASC`
  );
  return result.rows.map((row) => cloneRecord(row.payload));
}

async function getRecordById<TRecord>(client: PgClientLike, tableName: string, id: string): Promise<TRecord | null> {
  const result = await client.query<QueryResultRow<TRecord>>(
    `SELECT payload FROM ${tableName} WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ? cloneRecord(result.rows[0].payload) : null;
}

async function listRecordsByTaskId<TRecord>(
  client: PgClientLike,
  tableName: string,
  taskId: string
): Promise<TRecord[]> {
  const result = await client.query<QueryResultRow<TRecord>>(
    `SELECT payload FROM ${tableName} WHERE payload->>'taskId' = $1 ORDER BY updated_at ASC`,
    [taskId]
  );
  return result.rows.map((row) => cloneRecord(row.payload));
}

async function getRecordByTaskId<TRecord>(
  client: PgClientLike,
  tableName: string,
  taskId: string
): Promise<TRecord | null> {
  const result = await client.query<QueryResultRow<TRecord>>(
    `SELECT payload FROM ${tableName} WHERE payload->>'taskId' = $1 LIMIT 1`,
    [taskId]
  );
  return result.rows[0] ? cloneRecord(result.rows[0].payload) : null;
}

async function listRecordsByExecutionId<TRecord>(
  client: PgClientLike,
  tableName: string,
  executionId: string
): Promise<TRecord[]> {
  const result = await client.query<QueryResultRow<TRecord>>(
    `SELECT payload FROM ${tableName} WHERE payload->>'executionId' = $1 ORDER BY updated_at ASC`,
    [executionId]
  );
  return result.rows.map((row) => cloneRecord(row.payload));
}

async function upsertRecord<TRecord extends { id: string }>(
  client: PgClientLike,
  tableName: string,
  record: TRecord
): Promise<void> {
  const payload = JSON.stringify(record);
  await client.query(
    `INSERT INTO ${tableName} (id, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       updated_at = NOW()`,
    [record.id, payload]
  );
}

export function createPostgresTaskRepository(options: PostgresPersistenceOptions): TaskRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.taskTable);
  const ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.taskTable, []);

  return {
    async list() {
      await ensureBootstrapped();
      return listRecords<TaskRecord>(runtime.client, tableName);
    },
    async getById(taskId) {
      await ensureBootstrapped();
      return getRecordById<TaskRecord>(runtime.client, tableName, taskId);
    },
    async save(task) {
      await ensureBootstrapped();
      await upsertRecord(runtime.client, tableName, task);
    },
    async update(taskId, updater) {
      await ensureBootstrapped();
      const current = await getRecordById<TaskRecord>(runtime.client, tableName, taskId);
      if (!current) {
        return null;
      }
      const updated = updater(current);
      await upsertRecord(runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresApprovalRepository(options: PostgresPersistenceOptions): ApprovalRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.approvalTable);
  const ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.approvalTable, ['taskId']);

  return {
    async list() {
      await ensureBootstrapped();
      return listRecords<ApprovalRecord>(runtime.client, tableName);
    },
    async listByTaskId(taskId) {
      await ensureBootstrapped();
      return listRecordsByTaskId<ApprovalRecord>(runtime.client, tableName, taskId);
    },
    async save(approval) {
      await ensureBootstrapped();
      await upsertRecord(runtime.client, tableName, approval);
    },
    async updateStatus(approvalId, status) {
      await ensureBootstrapped();
      const current = await getRecordById<ApprovalRecord>(runtime.client, tableName, approvalId);
      if (!current) {
        return null;
      }
      const updated: ApprovalRecord = {
        ...current,
        status,
        resolvedAt: new Date().toISOString(),
      };
      await upsertRecord(runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresExecutionRepository(options: PostgresPersistenceOptions): ExecutionRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.executionTable);
  const ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.executionTable, ['taskId']);

  return {
    async list() {
      await ensureBootstrapped();
      return listRecords<ExecutionRecord>(runtime.client, tableName);
    },
    async getById(executionId) {
      await ensureBootstrapped();
      return getRecordById<ExecutionRecord>(runtime.client, tableName, executionId);
    },
    async listByTaskId(taskId) {
      await ensureBootstrapped();
      return listRecordsByTaskId<ExecutionRecord>(runtime.client, tableName, taskId);
    },
    async save(execution) {
      await ensureBootstrapped();
      await upsertRecord(runtime.client, tableName, execution);
    },
    async update(executionId, updater) {
      await ensureBootstrapped();
      const current = await getRecordById<ExecutionRecord>(runtime.client, tableName, executionId);
      if (!current) {
        return null;
      }
      const updated = updater(current);
      await upsertRecord(runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresTaskAssignmentRepository(options: PostgresPersistenceOptions): TaskAssignmentRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.taskAssignmentTable);
  const ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.taskAssignmentTable, ['taskId']);

  return {
    async list() {
      await ensureBootstrapped();
      return listRecords<TaskAssignment>(runtime.client, tableName);
    },
    async getById(assignmentId) {
      await ensureBootstrapped();
      return getRecordById<TaskAssignment>(runtime.client, tableName, assignmentId);
    },
    async listByTaskId(taskId) {
      await ensureBootstrapped();
      return listRecordsByTaskId<TaskAssignment>(runtime.client, tableName, taskId);
    },
    async save(assignment) {
      await ensureBootstrapped();
      await upsertRecord(runtime.client, tableName, assignment);
    },
    async update(assignmentId, updater) {
      await ensureBootstrapped();
      const current = await getRecordById<TaskAssignment>(runtime.client, tableName, assignmentId);
      if (!current) {
        return null;
      }
      const updated = updater(current);
      await upsertRecord(runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresWorkflowPlanRepository(options: PostgresPersistenceOptions): WorkflowPlanRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.workflowPlanTable);
  const ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.workflowPlanTable, ['taskId']);

  return {
    async list() {
      await ensureBootstrapped();
      return listRecords<WorkflowPlan>(runtime.client, tableName);
    },
    async getByTaskId(taskId) {
      await ensureBootstrapped();
      return getRecordByTaskId<WorkflowPlan>(runtime.client, tableName, taskId);
    },
    async save(plan) {
      await ensureBootstrapped();
      await upsertRecord(runtime.client, tableName, plan);
    },
    async update(taskId, updater) {
      await ensureBootstrapped();
      const current = await getRecordByTaskId<WorkflowPlan>(runtime.client, tableName, taskId);
      if (!current) {
        return null;
      }
      const updated = updater(current);
      await upsertRecord(runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}

export function createPostgresToolCallLogRepository(options: PostgresPersistenceOptions): ToolCallLogRepository {
  const runtime = resolveRuntime(options);
  const tableName = qualifyTable(runtime.schema, runtime.toolCallLogTable);
  const ensureBootstrapped = createBootstrapper(runtime.client, tableName, runtime.toolCallLogTable, [
    'taskId',
    'executionId',
  ]);

  return {
    async list() {
      await ensureBootstrapped();
      return listRecords<ToolCallLog>(runtime.client, tableName);
    },
    async getById(toolCallLogId) {
      await ensureBootstrapped();
      return getRecordById<ToolCallLog>(runtime.client, tableName, toolCallLogId);
    },
    async listByTaskId(taskId) {
      await ensureBootstrapped();
      return listRecordsByTaskId<ToolCallLog>(runtime.client, tableName, taskId);
    },
    async listByExecutionId(executionId) {
      await ensureBootstrapped();
      return listRecordsByExecutionId<ToolCallLog>(runtime.client, tableName, executionId);
    },
    async save(toolCallLog) {
      await ensureBootstrapped();
      await upsertRecord(runtime.client, tableName, toolCallLog);
    },
    async update(toolCallLogId, updater) {
      await ensureBootstrapped();
      const current = await getRecordById<ToolCallLog>(runtime.client, tableName, toolCallLogId);
      if (!current) {
        return null;
      }
      const updated = updater(current);
      await upsertRecord(runtime.client, tableName, updated);
      return cloneRecord(updated);
    },
  };
}
