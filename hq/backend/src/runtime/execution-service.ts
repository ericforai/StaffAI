import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { TaskExecutionMode } from '../shared/task-types';

export interface ExecutionLifecycleRecord {
  id: string;
  taskId: string;
  status: 'pending' | 'completed' | 'failed';
  executor: 'claude' | 'codex' | 'openai';
  outputSummary?: string;
  errorMessage?: string;
  memoryContextExcerpt?: string;
  startedAt: string;
  completedAt?: string;
}

export function runTaskExecution(
  input: {
    taskId: string;
    executor: 'claude' | 'codex' | 'openai';
    summary: string;
    memoryContextExcerpt?: string;
    executionMode?: TaskExecutionMode;
  },
  store: Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>
) {
  const started = beginExecution({
    taskId: input.taskId,
    executor: input.executor,
    memoryContextExcerpt: input.memoryContextExcerpt,
  });

  store.saveExecution(started);
  const completed = completeExecution(started, { summary: input.summary });
  store.updateExecution(started.id, () => completed);
  const task = store.updateTask(input.taskId, (currentTask) => ({
    ...currentTask,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  }));

  return {
    execution: completed,
    task,
  };
}

export function beginExecution(input: {
  taskId: string;
  executor: 'claude' | 'codex' | 'openai';
  memoryContextExcerpt?: string;
}): ExecutionLifecycleRecord {
  return {
    id: randomUUID(),
    taskId: input.taskId,
    status: 'pending',
    executor: input.executor,
    memoryContextExcerpt: input.memoryContextExcerpt,
    startedAt: new Date().toISOString(),
  };
}

export function completeExecution(
  execution: ExecutionLifecycleRecord,
  input: { summary: string }
): ExecutionLifecycleRecord {
  return {
    ...execution,
    status: 'completed',
    outputSummary: input.summary,
    completedAt: new Date().toISOString(),
  };
}

export function failExecution(
  execution: ExecutionLifecycleRecord,
  input: { errorMessage: string }
): ExecutionLifecycleRecord {
  return {
    ...execution,
    status: 'failed',
    errorMessage: input.errorMessage,
    completedAt: new Date().toISOString(),
  };
}
