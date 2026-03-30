import type express from 'express';
import path from 'node:path';
import type { Store } from '../store';
import type { ExecutionRecord, ToolCallLog } from '../shared/task-types';
import { createRuntimePaths } from '../runtime/runtime-state';
import { ExecutionStateStore, type ExecutionState } from '../runtime/execution-store';
import { TaskController } from '../runtime/task-controller';

const EXECUTIONS_API_STAGE = 'production';
const EXECUTION_FIELDS = [
  'id',
  'displayExecutionId',
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

function isLoopbackIp(ip: string | undefined): boolean {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.0.0.1');
}

function requireExecutionControlAccess(req: express.Request, res: express.Response): boolean {
  // Minimal guard: require explicit control header AND loopback origin by default.
  // This keeps accidental exposure safer without introducing full auth.
  const headerOk = String(req.header('X-Agency-Control') ?? '') === '1';
  const allowRemote = String(process.env.AGENCY_ALLOW_REMOTE_CONTROL ?? '').toLowerCase() === 'true';
  const ipOk = allowRemote ? true : isLoopbackIp(req.ip);
  if (!headerOk || !ipOk) {
    res.status(403).json({ error: 'execution control not allowed', stage: EXECUTIONS_API_STAGE });
    return false;
  }
  return true;
}

function mapExecutionRecordToState(execution: ExecutionRecord): ExecutionState {
  const startedAt = execution.startedAt || new Date().toISOString();
  const terminalOrControlled = new Set(['paused', 'cancelled', 'completed', 'failed']);
  const status = terminalOrControlled.has(execution.status) ? (execution.status as ExecutionState['status']) : 'running';

  return {
    executionId: execution.id,
    status,
    taskId: execution.taskId,
    workflowPlanId: execution.workflowPlanId,
    assignmentId: execution.assignmentId,
    executor: (execution.executor === 'claude' || execution.executor === 'codex' || execution.executor === 'openai' || execution.executor === 'deerflow') ? execution.executor : 'claude',
    startedAt,
    ...(execution.completedAt ? { completedAt: execution.completedAt } : {}),
    ...(execution.status === 'cancelled' ? { cancelledAt: execution.endedAt ?? new Date().toISOString() } : {}),
  };
}

async function ensureExecutionState(store: ExecutionStateStore, execution: ExecutionRecord): Promise<ExecutionState> {
  const existing = await store.load(execution.id);
  if (existing) {
    return existing;
  }
  const state = mapExecutionRecordToState(execution);
  await store.save(state);
  return state;
}

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

import type { WorkflowExecutionEngine } from '../orchestration/workflow-execution-engine';

export function registerExecutionRoutes(
  app: express.Application,
  store: Store,
  dependencies: { workflowExecutionEngine?: WorkflowExecutionEngine } = {}
) {
  const { workflowExecutionEngine } = dependencies;
  const runtimePaths = createRuntimePaths();
  const stateDir = path.join(runtimePaths.sessionsDir, 'executions');
  const executionStateStore = new ExecutionStateStore(stateDir);
  const taskController = new TaskController(executionStateStore);

  // ... (existing routes unchanged)

  /**
   * POST /api/workflows/:id/pause
   * 
   * Pause a running workflow.
   */
  app.post('/api/workflows/:id/pause', async (req, res) => {
    if (!requireExecutionControlAccess(req, res)) {
      return;
    }
    
    if (!workflowExecutionEngine) {
      return res.status(501).json({ error: 'workflow engine not available' });
    }

    const workflowPlanId = req.params.id;
    try {
      await workflowExecutionEngine.pause(workflowPlanId);
      return res.json({ 
        success: true, 
        workflowPlanId,
        status: workflowExecutionEngine.getStatus(workflowPlanId)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to pause workflow';
      return res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/workflows/:id/resume
   * 
   * Resume a paused workflow or resume from a manual checkpoint (HITL).
   */
  app.post('/api/workflows/:id/resume', async (req, res) => {
    if (!requireExecutionControlAccess(req, res)) {
      return;
    }

    if (!workflowExecutionEngine) {
      return res.status(501).json({ error: 'workflow engine not available' });
    }

    const workflowPlanId = req.params.id;
    const { checkpointData } = req.body;

    try {
      if (checkpointData) {
        // HITL: Resume from manual checkpoint
        const result = await workflowExecutionEngine.resumeFromCheckpoint(workflowPlanId, checkpointData);
        return res.json({ 
          success: true, 
          workflowPlanId, 
          result 
        });
      } else {
        // Normal resume
        await workflowExecutionEngine.resume(workflowPlanId);
        return res.json({ 
          success: true, 
          workflowPlanId,
          status: workflowExecutionEngine.getStatus(workflowPlanId)
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to resume workflow';
      return res.status(500).json({ error: message });
    }
  });

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
    const controlState = await ensureExecutionState(executionStateStore, execution);

    return res.json({
      execution: {
        ...execution,
        ...(toolCalls ? { toolCalls } : {}),
        controlState,
      },
      stage: EXECUTIONS_API_STAGE,
    });
  });

  app.get('/api/executions/:id/trace', async (req, res) => {
    const execution = await store.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({
        error: 'execution not found',
        executionId: req.params.id,
        stage: EXECUTIONS_API_STAGE,
      });
    }

    const [task, approvals, toolCalls, controlState] = await Promise.all([
      store.getTaskById(execution.taskId),
      store.getApprovalsByTaskId(execution.taskId),
      loadExecutionToolCalls(store, execution),
      ensureExecutionState(executionStateStore, execution),
    ]);

    const storeWithTrace = store as Store & Partial<{
      getExecutionTraceEventsByExecutionId: (executionId: string) => Promise<any[]>;
      getCostLogsByExecutionId: (executionId: string) => Promise<any[]>;
    }>;
    const [traceEvents, costLogs] = await Promise.all([
      typeof storeWithTrace.getExecutionTraceEventsByExecutionId === 'function'
        ? storeWithTrace.getExecutionTraceEventsByExecutionId(execution.id)
        : Promise.resolve([]),
      typeof storeWithTrace.getCostLogsByExecutionId === 'function'
        ? storeWithTrace.getCostLogsByExecutionId(execution.id)
        : Promise.resolve([]),
    ]);

    const tokensUsed =
      costLogs.length > 0 && typeof costLogs[costLogs.length - 1]?.tokensUsed === 'number'
        ? (costLogs[costLogs.length - 1].tokensUsed as number)
        : typeof (execution.outputSnapshot as any)?.tokensUsed === 'number'
          ? ((execution.outputSnapshot as any).tokensUsed as number)
          : undefined;

    return res.json({
      trace: {
        execution,
        task,
        approvals,
        toolCalls: toolCalls ?? [],
        controlState,
        traceEvents,
        costLogs,
        cost: {
          tokensUsed,
        },
        summary: {
          toolCalls: (toolCalls ?? []).length,
          approvals: approvals.length,
        },
      },
      stage: EXECUTIONS_API_STAGE,
    });
  });

  app.post('/api/executions/:id/cancel', async (req, res) => {
    if (!requireExecutionControlAccess(req, res)) {
      return;
    }
    const execution = await store.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({
        error: 'execution not found',
        executionId: req.params.id,
        stage: EXECUTIONS_API_STAGE,
      });
    }

    await ensureExecutionState(executionStateStore, execution);
    try {
      await taskController.cancel(execution.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'cannot cancel execution';
      return res.status(409).json({ error: message, stage: EXECUTIONS_API_STAGE });
    }

    const now = new Date().toISOString();
    const updated = await store.updateExecution(execution.id, (current) => ({
      ...current,
      status: 'cancelled',
      endedAt: current.endedAt ?? now,
      completedAt: current.completedAt ?? now,
    }));

    return res.json({
      execution: updated ?? execution,
      controlState: await executionStateStore.load(execution.id),
      stage: EXECUTIONS_API_STAGE,
    });
  });

  app.post('/api/executions/:id/pause', async (req, res) => {
    if (!requireExecutionControlAccess(req, res)) {
      return;
    }
    const execution = await store.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({
        error: 'execution not found',
        executionId: req.params.id,
        stage: EXECUTIONS_API_STAGE,
      });
    }

    await ensureExecutionState(executionStateStore, execution);
    try {
      await taskController.pause(execution.id, {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'cannot pause execution';
      return res.status(409).json({ error: message, stage: EXECUTIONS_API_STAGE });
    }

    const updated = await store.updateExecution(execution.id, (current) => ({
      ...current,
      status: 'paused',
    }));

    return res.json({
      execution: updated ?? execution,
      controlState: await executionStateStore.load(execution.id),
      stage: EXECUTIONS_API_STAGE,
    });
  });

  app.post('/api/executions/:id/resume', async (req, res) => {
    if (!requireExecutionControlAccess(req, res)) {
      return;
    }
    const execution = await store.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({
        error: 'execution not found',
        executionId: req.params.id,
        stage: EXECUTIONS_API_STAGE,
      });
    }

    await ensureExecutionState(executionStateStore, execution);
    try {
      await taskController.resume(execution.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'cannot resume execution';
      return res.status(409).json({ error: message, stage: EXECUTIONS_API_STAGE });
    }

    const updated = await store.updateExecution(execution.id, (current) => ({
      ...current,
      status: 'running',
    }));

    return res.json({
      execution: updated ?? execution,
      controlState: await executionStateStore.load(execution.id),
      stage: EXECUTIONS_API_STAGE,
    });
  });
}
