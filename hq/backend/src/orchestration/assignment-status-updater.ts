import { randomUUID } from 'node:crypto';
import type { TaskAssignmentStatus } from '../shared/task-types';
import type { Store } from '../store';
import type { AuditLogger } from '../governance/audit-logger';
import { logAssignmentAuditEvent } from './assignment-audit-logger';
import { resolveRuntimeName } from '../runtime/runtime-adapter';

/**
 * Update assignment execution status via store
 */
export async function updateAssignmentExecutionStatus(
  store: Pick<Store, 'updateTaskAssignment'>,
  assignmentId: string,
  status: TaskAssignmentStatus
): Promise<void> {
  const timestamps = buildAssignmentTimestamps(status);
  await store.updateTaskAssignment(assignmentId, (current) => ({
    ...current,
    status,
    updatedAt: timestamps.updatedAt,
    ...(!current.startedAt && timestamps.startedAt ? { startedAt: timestamps.startedAt } : {}),
    ...(timestamps.endedAt ? { endedAt: timestamps.endedAt } : {}),
    ...(timestamps.completedAt ? { completedAt: timestamps.completedAt } : {}),
  }));
}

/**
 * Mark assignment as completed and save execution record
 */
export async function markAssignmentCompleted(
  store: Pick<Store, 'updateTaskAssignment' | 'saveExecution'>,
  executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow',
  assignmentId: string,
  outputSummary?: string,
  outputSnapshot?: Record<string, unknown>,
  resolveRuntimeNameFn?: (executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow') => string
): Promise<void> {
  const resolveName = resolveRuntimeNameFn || resolveRuntimeName;

  await store.updateTaskAssignment(assignmentId, (current) => ({
    ...current,
    status: 'completed',
    resultSummary: outputSummary ?? 'Completed successfully',
    endedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  await store.saveExecution({
    id: randomUUID(),
    taskId: await getTaskIdForAssignment(store, assignmentId) ?? 'unknown',
    status: 'completed',
    executor,
    runtimeName: resolveName(executor),
    assignmentId,
    outputSummary,
    outputSnapshot,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
}

/**
 * Mark assignment as failed
 */
export async function markAssignmentFailed(
  store: Pick<Store, 'updateTaskAssignment' | 'logAudit'>,
  assignmentId: string,
  errorMessage: string,
  auditLogger?: AuditLogger | null | undefined
): Promise<void> {
  await store.updateTaskAssignment(assignmentId, (current) => ({
    ...current,
    status: 'failed',
    errorMessage,
    endedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  await logAssignmentAuditEvent(store, auditLogger ?? null, {
    entityType: 'execution',
    entityId: assignmentId,
    action: 'failed',
    actor: 'system',
    newState: { status: 'failed', error: errorMessage },
  });
}

/**
 * Get task ID for an assignment (fallback helper)
 */
async function getTaskIdForAssignment(
  store: Pick<Store, 'updateTaskAssignment'>,
  assignmentId: string
): Promise<string | undefined> {
  // We can't get task ID from the current store interface without additional methods
  // Return undefined and let the execution record use a placeholder
  return undefined;
}

function buildAssignmentTimestamps(status: TaskAssignmentStatus): {
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  completedAt?: string;
} {
  const now = new Date().toISOString();

  if (status === 'running') {
    return { updatedAt: now, startedAt: now };
  }

  if (status === 'completed') {
    return {
      updatedAt: now,
      endedAt: now,
      completedAt: now,
    };
  }

  if (status === 'failed' || status === 'skipped') {
    return {
      updatedAt: now,
      endedAt: now,
    };
  }

  if (status === 'waiting_input') {
    return { updatedAt: now };
  }

  return { updatedAt: now };
}
