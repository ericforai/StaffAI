import { Queue } from 'bullmq';
import { RedisService } from './redis-service';
import type { TaskExecutionMode } from '../shared/task-types';

export interface EnqueueTaskPayload {
  taskId: string;
  executor: 'claude' | 'codex' | 'openai' | 'deerflow';
  summary: string;
  executionMode?: TaskExecutionMode;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * BullMQ Queue for task execution jobs.
 */
let taskExecutionQueueSingleton: Queue | null = null;

export function getTaskExecutionQueue(): Queue {
  if (!taskExecutionQueueSingleton) {
    taskExecutionQueueSingleton = new Queue('task-execution', {
      connection: RedisService.getInstance(),
    });
  }
  return taskExecutionQueueSingleton;
}

/**
 * Enqueue a task for background execution.
 */
export async function enqueueTaskExecution(payload: EnqueueTaskPayload): Promise<void> {
  const queue = getTaskExecutionQueue();
  await queue.add('execute-task', payload, {
    attempts: payload.maxRetries ?? 1,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
  console.log(`Enqueued task ${payload.taskId} for background execution`);
}

export async function closeTaskExecutionQueue(): Promise<void> {
  if (taskExecutionQueueSingleton) {
    await taskExecutionQueueSingleton.close();
    taskExecutionQueueSingleton = null;
  }
}
