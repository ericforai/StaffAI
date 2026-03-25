import type express from 'express';
import type { Store } from '../store';
import type { ExecutionRecord, ToolCallLog } from '../shared/task-types';

const EXECUTIONS_API_STAGE = 'production';
const EXECUTION_FIELDS = [
  'id',
  'taskId',
  'status',
  'executor',
  'runtimeName',
  'degraded',
  'retryCount',
  'maxRetries',
  'timeoutMs',
  'assignmentId',
  'assignmentRole',
  'workflowStepId',
  'workflowPlanId',
  'inputSnapshot',
  'outputSnapshot',
  'structuredError',
  'outputSummary',
  'errorMessage',
  'memoryContextExcerpt',
  'startedAt',
  'endedAt',
  'completedAt',
] as const;
type ExecutionField = (typeof EXECUTION_FIELDS)[number];

function readStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readFieldsQuery(value: unknown): ExecutionField[] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const requested = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is ExecutionField => {
      return (EXECUTION_FIELDS as readonly string[]).includes(entry);
    });

  return requested.length > 0 ? requested : undefined;
}

function readLimitQuery(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function sortExecutionsByMostRecent(executions: ExecutionRecord[]): ExecutionRecord[] {
  return executions.slice().sort((left, right) => {
    const leftTime = Date.parse(left.completedAt || left.startedAt || '1970-01-01T00:00:00.000Z');
    const rightTime = Date.parse(right.completedAt || right.startedAt || '1970-01-01T00:00:00.000Z');
    return rightTime - leftTime;
  });
}

function countByStatus(executions: ExecutionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const execution of executions) {
    const status = execution.status || 'unknown';
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}

function countByExecutor(executions: ExecutionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const execution of executions) {
    if (!execution.executor) {
      continue;
    }

    counts[execution.executor] = (counts[execution.executor] ?? 0) + 1;
  }

  return counts;
}

function projectExecution(
  execution: ExecutionRecord,
  fields?: ExecutionField[],
): ExecutionRecord | Partial<ExecutionRecord> {
  if (!fields) {
    return execution;
  }

  const projected: Partial<ExecutionRecord> = {};
  for (const field of fields) {
    Reflect.set(projected, field, execution[field]);
  }

  return projected;
}

type ExecutionDetailRecord = ExecutionRecord & {
  toolCalls?: ToolCallLog[];
};

async function loadExecutionToolCalls(store: Store, execution: ExecutionRecord): Promise<ToolCallLog[] | undefined> {
  const storeWithToolCalls = store as Store & Partial<{
    getToolCallLogsByExecutionId: (executionId: string) => Promise<ToolCallLog[]>;
  }>;

  if (typeof storeWithToolCalls.getToolCallLogsByExecutionId === 'function') {
    return await storeWithToolCalls.getToolCallLogsByExecutionId(execution.id);
  }

  const executionWithToolCalls = execution as ExecutionDetailRecord;
  return executionWithToolCalls.toolCalls;
}

export function registerExecutionRoutes(app: express.Application, store: Store) {
  app.get('/api/executions', async (req, res) => {
    const taskId = readStringQuery(req.query.taskId);
    const status = readStringQuery(req.query.status);
    const executor = readStringQuery(req.query.executor);
    const limit = readLimitQuery(req.query.limit);
    const fields = readFieldsQuery(req.query.fields);
    const baseExecutions = taskId ? await store.getExecutionsByTaskId(taskId) : await store.getExecutions();
    const total = baseExecutions.length;
    const matched = baseExecutions.filter((execution) => {
      if (status && execution.status !== status) {
        return false;
      }

      if (executor && execution.executor !== executor) {
        return false;
      }

      return true;
    });
    const sorted = sortExecutionsByMostRecent(matched);
    const limited = typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
    const projected = limited.map((execution) => projectExecution(execution, fields));

    return res.json({
      executions: projected,
      summary: {
        total,
        matched: sorted.length,
        returned: limited.length,
        statusCounts: countByStatus(sorted),
        executorCounts: countByExecutor(sorted),
        ...(fields ? { projectedFields: fields } : {}),
        appliedFilters: {
          ...(taskId ? { taskId } : {}),
          ...(status ? { status } : {}),
          ...(executor ? { executor } : {}),
          ...(typeof limit === 'number' ? { limit } : {}),
        },
      },
      stage: EXECUTIONS_API_STAGE,
    });
  });

  app.get('/api/executions/:id', async (req, res) => {
    const execution = await store.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({
        error: 'execution not found',
        executionId: req.params.id,
        stage: EXECUTIONS_API_STAGE,
      });
    }

    const toolCalls = await loadExecutionToolCalls(store, execution);

    return res.json({
      execution: {
        ...execution,
        ...(toolCalls ? { toolCalls } : {}),
      },
      stage: EXECUTIONS_API_STAGE,
    });
  });
}
