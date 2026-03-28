import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type {
  ExecutionRecord,
  TaskAssignment,
  TaskExecutionMode,
  TaskRecord,
  WorkflowPlan,
} from '../shared/task-types';
import {
  resolveRuntimeAdapter,
  resolveRuntimeName,
  type RuntimeExecutionContext,
  type RuntimeExecutionError,
} from './runtime-adapter';
import { resolveTaskTimeoutMs } from './task-execution-config';

export interface SerialWorkflowBundle {
  workflowPlan: WorkflowPlan;
  assignments: TaskAssignment[];
}

export type ExecutionLifecycleRecord = ExecutionRecord;

function resolveFallbackExecutors(preferred: 'claude' | 'codex' | 'openai' | 'deerflow'): Array<'claude' | 'codex' | 'openai' | 'deerflow'> {
  switch (preferred) {
    case 'claude':
      return ['openai', 'codex'];
    case 'codex':
      return ['openai', 'claude'];
    case 'openai':
      return ['claude', 'codex'];
    default:
      return [];
  }
}

function buildExecutionDisplayPrefix(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildFallbackExecutionDisplayId(date = new Date()): string {
  const prefix = buildExecutionDisplayPrefix(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${prefix}-${hh}${mm}${ss}`;
}

async function generateExecutionDisplayId(
  store: Partial<Pick<Store, 'getExecutions'>>,
): Promise<string> {
  if (typeof store.getExecutions !== 'function') {
    return buildFallbackExecutionDisplayId();
  }

  const prefix = buildExecutionDisplayPrefix();
  const executions = await store.getExecutions();
  const existingIds = new Set(
    executions
      .filter((e) => typeof e.displayExecutionId === 'string' && e.displayExecutionId.startsWith(prefix))
      .map((e) => e.displayExecutionId),
  );

  for (let seq = 1; seq <= 999; seq++) {
    const candidate = `${prefix}-${String(seq).padStart(3, '0')}`;
    if (!existingIds.has(candidate)) return candidate;
  }

  // Fallback to timestamp-based ID if all sequential slots taken
  return `${prefix}-${Date.now()}`;
}

function mapExecutionStatusToChinese(status: ExecutionLifecycleRecord['status']): string {
  switch (status) {
    case 'completed':
      return '完成';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '取消';
    case 'degraded':
      return '降级';
    case 'running':
      return '进行中';
    case 'pending':
      return '已启动';
    default:
      return '未知状态';
  }
}

function createSerialWorkflowBundle(input: {
  taskId: string;
  title: string;
  primaryRole: string;
}): SerialWorkflowBundle {
  const now = new Date().toISOString();
  const workflowPlanId = randomUUID();
  const firstAssignmentId = randomUUID();
  const secondAssignmentId = randomUUID();
  const firstStepId = randomUUID();
  const secondStepId = randomUUID();

  return {
    workflowPlan: {
      id: workflowPlanId,
      taskId: input.taskId,
      mode: 'serial',
      synthesisRequired: true,
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          id: firstStepId,
          order: 1,
          title: `Draft ${input.title}`,
          assignmentId: firstAssignmentId,
          agentId: input.primaryRole,
          assignmentRole: 'primary',
          status: 'pending',
        },
        {
          id: secondStepId,
          order: 2,
          title: `Review and finalize ${input.title}`,
          assignmentId: secondAssignmentId,
          agentId: 'dispatcher',
          assignmentRole: 'dispatcher',
          status: 'pending',
        },
      ],
    },
    assignments: [
      {
        id: firstAssignmentId,
        taskId: input.taskId,
        workflowPlanId,
        stepId: firstStepId,
        agentId: input.primaryRole,
        assignmentRole: 'primary',
        status: 'pending',
      },
      {
        id: secondAssignmentId,
        taskId: input.taskId,
        workflowPlanId,
        stepId: secondStepId,
        agentId: 'dispatcher',
        assignmentRole: 'dispatcher',
        status: 'pending',
      },
    ],
  };
}

function completeSerialWorkflowBundle(bundle: SerialWorkflowBundle): SerialWorkflowBundle {
  const completedAt = new Date().toISOString();

  return {
    workflowPlan: {
      ...bundle.workflowPlan,
      status: 'completed',
      updatedAt: completedAt,
      steps: bundle.workflowPlan.steps.map((step) => ({
        ...step,
        status: 'completed',
      })),
    },
    assignments: bundle.assignments.map((assignment) => ({
      ...assignment,
      status: 'completed',
      startedAt: assignment.startedAt ?? completedAt,
      endedAt: completedAt,
      completedAt,
    })),
  };
}

function completeWorkflowArtifacts(input: {
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}): { workflowPlan?: WorkflowPlan; assignments?: TaskAssignment[] } {
  if (!input.workflowPlan || !input.assignments || input.assignments.length === 0) {
    return {};
  }

  const completedAt = new Date().toISOString();
  const assignments = input.assignments.map((assignment) => ({
    ...assignment,
    status: 'completed' as const,
    startedAt: assignment.startedAt ?? completedAt,
    endedAt: completedAt,
    completedAt,
    updatedAt: completedAt,
  }));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));

  return {
    assignments,
    workflowPlan: {
      ...input.workflowPlan,
      status: 'completed',
      updatedAt: completedAt,
      steps: input.workflowPlan.steps.map((step) => ({
        ...step,
        status: assignmentIds.has(step.assignmentId) ? 'completed' : step.status,
      })),
    },
  };
}

export function buildSerialWorkflowPlan(input: {
  id: string;
  title: string;
  description: string;
  executionMode: 'serial';
  recommendedAgentRole: string;
}): SerialWorkflowBundle {
  return createSerialWorkflowBundle({
    taskId: input.id,
    title: input.title,
    primaryRole: input.recommendedAgentRole || 'software-architect',
  });
}

export async function runTaskExecution(
  input: {
    taskId: string;
    executor: 'claude' | 'codex' | 'openai' | 'deerflow';
    runtimeName?: string;
    summary: string;
    memoryContextExcerpt?: string;
    executionMode?: TaskExecutionMode;
    workflowPlan?: WorkflowPlan;
    assignments?: TaskAssignment[];
    task?: TaskRecord;
    taskTitle?: string;
    recommendedAgentRole?: string;
    timeoutMs?: number;
    maxRetries?: number;
    degraded?: boolean;
    inputSnapshot?: Record<string, unknown>;
    onEvent?: (event: { type: string; data: any }) => void;
    runtimeRunner?: (context: RuntimeExecutionContext) => Promise<{
      outputSummary: string;
      outputSnapshot?: Record<string, unknown>;
    }>;
  },
  store: Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'> &
    Partial<
      Pick<Store, 'saveTaskAssignment' | 'updateTaskAssignment' | 'saveWorkflowPlan' | 'updateWorkflowPlan' | 'getExecutions'>
    >
): Promise<{
  execution: ExecutionLifecycleRecord;
  task: Awaited<ReturnType<Store['updateTask']>>;
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}> {
  const storeWithObservability = store as (typeof store) &
    Partial<Pick<Store, 'appendExecutionTraceEvent' | 'saveCostLogEntry'>>;

  const timeoutMs = resolveTaskTimeoutMs(input.timeoutMs);
  const maxRetries = Number.isFinite(input.maxRetries) && (input.maxRetries ?? 0) >= 0 ? (input.maxRetries as number) : 1;
  const runtimeName = input.runtimeName || resolveRuntimeName(input.executor);
  const runtimeAdapter = resolveRuntimeAdapter(input.executor);
  const displayExecutionId = await generateExecutionDisplayId(store);

  const serialBundle =
    input.executionMode === 'serial'
      ? input.workflowPlan && input.assignments
        ? {
            workflowPlan: input.workflowPlan,
            assignments: input.assignments,
          }
        : buildSerialWorkflowPlan({
            id: input.taskId,
            title: input.taskTitle ?? input.taskId,
            description: input.summary,
            executionMode: 'serial',
            recommendedAgentRole: input.recommendedAgentRole ?? 'software-architect',
          })
      : undefined;
  const completedWorkflowArtifacts =
    serialBundle ??
    (input.workflowPlan && input.assignments
      ? completeWorkflowArtifacts({
          workflowPlan: input.workflowPlan,
          assignments: input.assignments,
        })
      : undefined);
  const started = beginExecution({
    taskId: input.taskId,
    executor: input.executor,
    displayExecutionId,
    runtimeName,
    degraded: input.degraded,
    timeoutMs,
    maxRetries,
    inputSnapshot: input.inputSnapshot,
    memoryContextExcerpt: input.memoryContextExcerpt,
    workflowPlan: completedWorkflowArtifacts?.workflowPlan,
    assignments: completedWorkflowArtifacts?.assignments,
  });

  await store.saveExecution(started);
  if (typeof storeWithObservability.appendExecutionTraceEvent === 'function') {
    await storeWithObservability.appendExecutionTraceEvent({
      id: `trace_exec_${started.id}_${Date.now()}`,
      type: 'execution_started',
      taskId: input.taskId,
      executionId: started.id,
      occurredAt: new Date().toISOString(),
      actor: input.executor,
      summary: `开始执行任务：${input.taskTitle ?? input.taskId}`,
      data: {
        executor: input.executor,
        runtimeName,
        executionMode: input.executionMode ?? 'single',
      },
    });
  }
  let lastError: RuntimeExecutionError | undefined;
  let finalizedExecution: ExecutionLifecycleRecord | null = null;
  let finalizedWorkflowArtifacts: { workflowPlan?: WorkflowPlan; assignments?: TaskAssignment[] } | undefined;
  let finalAttempt = 0;
  let resolvedExecutor: 'claude' | 'codex' | 'openai' | 'deerflow' = input.executor;
  let resolvedRuntimeName = runtimeName;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    finalAttempt = attempt;
    try {
      const runtimeContext: RuntimeExecutionContext = {
        task: input.task ?? {
            id: input.taskId,
            title: input.taskTitle ?? input.taskId,
            description: input.summary,
            taskType: 'general',
            priority: 'medium',
            status: 'running',
            executionMode: input.executionMode ?? 'single',
            approvalRequired: false,
            riskLevel: 'low',
            requestedBy: 'system',
            requestedAt: new Date().toISOString(),
            recommendedAgentRole: input.recommendedAgentRole ?? 'dispatcher',
            candidateAgentRoles: [input.recommendedAgentRole ?? 'dispatcher'],
            routeReason: 'runtime fallback context',
            routingStatus: 'manual_review',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        executor: input.executor,
        runtimeName,
        executionMode: input.executionMode ?? 'single',
        summary: input.summary,
        memoryContextExcerpt: input.memoryContextExcerpt,
        timeoutMs,
        maxRetries,
        inputSnapshot: input.inputSnapshot,
        onEvent: input.onEvent,
      };
      const runtimeResult = await withTimeout(
        input.runtimeRunner ? input.runtimeRunner(runtimeContext) : runtimeAdapter.run(runtimeContext),
        timeoutMs,
      );

      if (runtimeResult.outputSnapshot?.degraded) {
        lastError = {
          code: 'execution_failed',
          message: runtimeResult.outputSummary || 'Execution returned a degraded runtime result',
          retriable: false,
          details: runtimeResult.outputSnapshot ? { outputSnapshot: runtimeResult.outputSnapshot } : undefined,
        };
        finalizedExecution = failExecution(started, {
          errorMessage: lastError.message,
          retryCount: attempt,
          maxRetries,
          timeoutMs,
          degraded: true,
          structuredError: lastError,
        });
        break;
      }

      finalizedWorkflowArtifacts = serialBundle
        ? completeSerialWorkflowBundle(serialBundle)
        : completedWorkflowArtifacts;
      finalizedExecution = finalizedWorkflowArtifacts
        ? completeExecution({ ...started, executor: resolvedExecutor, runtimeName: resolvedRuntimeName }, {
            summary: runtimeResult.outputSummary || input.summary,
            outputSnapshot: runtimeResult.outputSnapshot,
            workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
            assignments: finalizedWorkflowArtifacts.assignments,
            retryCount: attempt,
            maxRetries,
            timeoutMs,
            degraded: input.degraded,
          })
        : completeExecution({ ...started, executor: resolvedExecutor, runtimeName: resolvedRuntimeName }, {
            summary: runtimeResult.outputSummary || input.summary,
            outputSnapshot: runtimeResult.outputSnapshot,
            retryCount: attempt,
            maxRetries,
            timeoutMs,
            degraded: input.degraded,
          });
      break;
    } catch (error) {
      lastError = toRuntimeError(error, timeoutMs);
      if (attempt < maxRetries && lastError.retriable) {
        continue;
      }
    }
  }

  if (
    !finalizedExecution &&
    !input.runtimeRunner &&
    input.executor === 'claude' &&
    lastError?.retriable
  ) {
    const fallbackExecutors = resolveFallbackExecutors(input.executor);

    for (const fallbackExecutor of fallbackExecutors) {
      try {
        const fallbackRuntimeName = resolveRuntimeName(fallbackExecutor);
        const fallbackAdapter = resolveRuntimeAdapter(fallbackExecutor);
        const runtimeContext: RuntimeExecutionContext = {
          task: input.task ?? {
              id: input.taskId,
              title: input.taskTitle ?? input.taskId,
              description: input.summary,
              taskType: 'general',
              priority: 'medium',
              status: 'running',
              executionMode: input.executionMode ?? 'single',
              approvalRequired: false,
              riskLevel: 'low',
              requestedBy: 'system',
              requestedAt: new Date().toISOString(),
              recommendedAgentRole: input.recommendedAgentRole ?? 'dispatcher',
              candidateAgentRoles: [input.recommendedAgentRole ?? 'dispatcher'],
              routeReason: 'runtime fallback context',
              routingStatus: 'manual_review',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          executor: fallbackExecutor,
          runtimeName: fallbackRuntimeName,
          executionMode: input.executionMode ?? 'single',
          summary: input.summary,
          memoryContextExcerpt: input.memoryContextExcerpt,
          timeoutMs,
          maxRetries,
          inputSnapshot: input.inputSnapshot,
          onEvent: input.onEvent,
        };
        const fallbackResult = await withTimeout(fallbackAdapter.run(runtimeContext), timeoutMs);

        if (fallbackResult.outputSnapshot?.degraded) {
          lastError = {
            code: 'execution_failed',
            message: fallbackResult.outputSummary || 'Execution returned a degraded runtime result',
            retriable: false,
            details: fallbackResult.outputSnapshot ? { outputSnapshot: fallbackResult.outputSnapshot } : undefined,
          };
          continue;
        }

        resolvedExecutor = fallbackExecutor;
        resolvedRuntimeName = fallbackRuntimeName;
        const fallbackSnapshot =
          fallbackResult.outputSnapshot && typeof fallbackResult.outputSnapshot === 'object'
            ? {
                ...fallbackResult.outputSnapshot,
                additionalData: {
                  ...((fallbackResult.outputSnapshot.additionalData as Record<string, unknown> | undefined) ?? {}),
                  fallbackFrom: input.executor,
                },
              }
            : fallbackResult.outputSnapshot;

        finalizedWorkflowArtifacts = serialBundle
          ? completeSerialWorkflowBundle(serialBundle)
          : completedWorkflowArtifacts;
        finalizedExecution = finalizedWorkflowArtifacts
          ? completeExecution({ ...started, executor: fallbackExecutor, runtimeName: fallbackRuntimeName }, {
              summary: fallbackResult.outputSummary || input.summary,
              outputSnapshot: fallbackSnapshot,
              workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
              assignments: finalizedWorkflowArtifacts.assignments,
              retryCount: finalAttempt,
              maxRetries,
              timeoutMs,
              degraded: input.degraded,
            })
          : completeExecution({ ...started, executor: fallbackExecutor, runtimeName: fallbackRuntimeName }, {
              summary: fallbackResult.outputSummary || input.summary,
              outputSnapshot: fallbackSnapshot,
              retryCount: finalAttempt,
              maxRetries,
              timeoutMs,
              degraded: input.degraded,
            });
        break;
      } catch (error) {
        lastError = toRuntimeError(error, timeoutMs);
      }
    }
  }

  const completedOrFailed =
    finalizedExecution ??
    failExecution({ ...started, executor: resolvedExecutor, runtimeName: resolvedRuntimeName }, {
      errorMessage: lastError?.message || '执行失败',
      retryCount: finalAttempt,
      maxRetries,
      timeoutMs,
      degraded: input.degraded,
      structuredError: lastError,
    });
  await store.updateExecution(started.id, () => completedOrFailed);

  if (typeof storeWithObservability.appendExecutionTraceEvent === 'function') {
    await storeWithObservability.appendExecutionTraceEvent({
      id: `trace_exec_${started.id}_${Date.now()}`,
      type:
        completedOrFailed.status === 'completed'
          ? 'execution_completed'
          : completedOrFailed.status === 'degraded'
            ? 'execution_degraded'
            : completedOrFailed.status === 'cancelled'
              ? 'execution_cancelled'
              : 'execution_failed',
      taskId: input.taskId,
      executionId: started.id,
      occurredAt: new Date().toISOString(),
      actor: completedOrFailed.executor ?? input.executor,
      summary: `${mapExecutionStatusToChinese(completedOrFailed.status)}任务：${input.taskTitle ?? input.taskId}`,
      data: {
        status: completedOrFailed.status,
        degraded: completedOrFailed.degraded,
        retryCount: completedOrFailed.retryCount,
        executor: completedOrFailed.executor ?? input.executor,
        runtimeName: completedOrFailed.runtimeName ?? runtimeName,
      },
    });
  }

  const snapshot = completedOrFailed.outputSnapshot as Record<string, unknown> | undefined;
  const tokensUsed = typeof snapshot?.tokensUsed === 'number' ? (snapshot.tokensUsed as number) : undefined;
  if (typeof storeWithObservability.saveCostLogEntry === 'function' && tokensUsed !== undefined) {
    const recordedAt = new Date().toISOString();
    const costEntry = {
      id: randomUUID(),
      taskId: input.taskId,
      executionId: started.id,
      recordedAt,
      source: 'runtime_output_snapshot' as const,
      executor: completedOrFailed.executor ?? input.executor,
      runtimeName: completedOrFailed.runtimeName ?? runtimeName,
      tokensUsed,
      modelVersion: typeof snapshot?.modelVersion === 'string' ? (snapshot.modelVersion as string) : undefined,
      responseTimeMs: typeof snapshot?.responseTimeMs === 'number' ? (snapshot.responseTimeMs as number) : undefined,
      cacheStatus:
        snapshot?.cacheStatus === 'hit' || snapshot?.cacheStatus === 'miss' || snapshot?.cacheStatus === 'disabled'
          ? (snapshot.cacheStatus as 'hit' | 'miss' | 'disabled')
          : undefined,
    };

    await storeWithObservability.saveCostLogEntry(costEntry);
    if (typeof storeWithObservability.appendExecutionTraceEvent === 'function') {
      await storeWithObservability.appendExecutionTraceEvent({
        id: `trace_cost_${costEntry.id}_${Date.now()}`,
        type: 'cost_observed',
        taskId: input.taskId,
        executionId: started.id,
        occurredAt: recordedAt,
        actor: input.executor,
        summary: `本次消耗：${tokensUsed} tokens`,
        data: {
          costLogEntryId: costEntry.id,
          tokensUsed,
          modelVersion: costEntry.modelVersion,
          responseTimeMs: costEntry.responseTimeMs,
        },
      });
    }
  }

  if (finalizedWorkflowArtifacts?.workflowPlan && finalizedWorkflowArtifacts.assignments) {
    if (store.updateWorkflowPlan) {
      const updatedPlan = await store.updateWorkflowPlan(input.taskId, () => finalizedWorkflowArtifacts.workflowPlan!);
      if (!updatedPlan && store.saveWorkflowPlan) {
        await store.saveWorkflowPlan(finalizedWorkflowArtifacts.workflowPlan);
      }
    } else if (store.saveWorkflowPlan) {
      await store.saveWorkflowPlan(finalizedWorkflowArtifacts.workflowPlan);
    }

    for (const assignment of finalizedWorkflowArtifacts.assignments) {
      if (store.updateTaskAssignment) {
        const updatedAssignment = await store.updateTaskAssignment(assignment.id, () => assignment);
        if (!updatedAssignment && store.saveTaskAssignment) {
          await store.saveTaskAssignment(assignment);
        }
      } else if (store.saveTaskAssignment) {
        await store.saveTaskAssignment(assignment);
      }
    }
  }

  const task = await store.updateTask(input.taskId, (currentTask) => ({
    ...currentTask,
    status: completedOrFailed.status === 'completed' ? 'completed' : 'failed',
    updatedAt: new Date().toISOString(),
  }));

  return {
    execution: completedOrFailed,
    task,
    ...(finalizedWorkflowArtifacts
      ? {
          workflowPlan: finalizedWorkflowArtifacts.workflowPlan,
          assignments: finalizedWorkflowArtifacts.assignments,
        }
      : {}),
  };
}

export function beginExecution(input: {
  taskId: string;
  executor: 'claude' | 'codex' | 'openai' | 'deerflow';
  displayExecutionId?: string;
  runtimeName?: string;
  degraded?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  inputSnapshot?: Record<string, unknown>;
  memoryContextExcerpt?: string;
  workflowPlan?: WorkflowPlan;
  assignments?: TaskAssignment[];
}): ExecutionLifecycleRecord {
  return {
    id: randomUUID(),
    displayExecutionId: input.displayExecutionId ?? buildFallbackExecutionDisplayId(),
    taskId: input.taskId,
    status: 'pending',
    executor: input.executor,
    runtimeName: input.runtimeName || resolveRuntimeName(input.executor),
    degraded: Boolean(input.degraded),
    timeoutMs: input.timeoutMs,
    maxRetries: input.maxRetries,
    retryCount: 0,
    inputSnapshot: input.inputSnapshot,
    memoryContextExcerpt: input.memoryContextExcerpt,
    startedAt: new Date().toISOString(),
    ...(input.workflowPlan ? { workflowPlan: input.workflowPlan } : {}),
    ...(input.assignments ? { assignments: input.assignments } : {}),
  };
}

export function completeExecution(
  execution: ExecutionLifecycleRecord,
  input: {
    summary: string;
    outputSnapshot?: Record<string, unknown>;
    retryCount?: number;
    maxRetries?: number;
    timeoutMs?: number;
    degraded?: boolean;
    workflowPlan?: WorkflowPlan;
    assignments?: TaskAssignment[];
  }
): ExecutionLifecycleRecord {
  return {
    ...execution,
    status: 'completed',
    outputSummary: input.summary,
    outputSnapshot: input.outputSnapshot,
    retryCount: input.retryCount ?? execution.retryCount,
    maxRetries: input.maxRetries ?? execution.maxRetries,
    timeoutMs: input.timeoutMs ?? execution.timeoutMs,
    degraded: input.degraded ?? execution.degraded,
    endedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...(input.workflowPlan ? { workflowPlan: input.workflowPlan } : {}),
    ...(input.assignments ? { assignments: input.assignments } : {}),
  };
}

export function failExecution(
  execution: ExecutionLifecycleRecord,
  input: {
    errorMessage: string;
    retryCount?: number;
    maxRetries?: number;
    timeoutMs?: number;
    degraded?: boolean;
    structuredError?: RuntimeExecutionError;
  }
): ExecutionLifecycleRecord {
  return {
    ...execution,
    status: 'failed',
    errorMessage: input.errorMessage,
    retryCount: input.retryCount ?? execution.retryCount,
    maxRetries: input.maxRetries ?? execution.maxRetries,
    timeoutMs: input.timeoutMs ?? execution.timeoutMs,
    degraded: input.degraded ?? execution.degraded,
    structuredError: input.structuredError
      ? {
          code: input.structuredError.code,
          message: input.structuredError.message,
          retriable: input.structuredError.retriable,
          details: input.structuredError.details,
        }
      : execution.structuredError,
    endedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function toRuntimeError(error: unknown, timeoutMs: number): RuntimeExecutionError {
  const message = error instanceof Error ? error.message : 'Unknown runtime failure';
  if (message.includes('timed out')) {
    return {
      code: 'timeout',
      message,
      retriable: true,
      details: { timeoutMs },
    };
  }

  return {
    code: 'execution_failed',
    message,
    retriable: false,
  };
}
