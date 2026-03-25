import { Worker, type Job } from 'bullmq';
import { RedisService } from './redis-service';
import { executeTaskRecord } from '../orchestration/task-execution-orchestrator';
import { Store } from '../store';
import type { EnqueueTaskPayload } from './task-queue';

/**
 * Worker to process task execution jobs from the Redis queue.
 */
export function startTaskWorker(store: Store) {
  const worker = new Worker(
    'task-execution',
    async (job: Job<EnqueueTaskPayload>) => {
      const { taskId, executor, summary, executionMode, timeoutMs, maxRetries } = job.data;
      
      console.log(`Worker processing task ${taskId} (Attempt ${job.attemptsMade + 1})...`);
      
      const task = await store.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found in store`);
      }

      // Execute the task synchronously within the worker
      // We pass the store and mock/real dependencies as needed
      await executeTaskRecord(
        task,
        {
          executor,
          summary,
          executionMode,
          timeoutMs,
          maxRetries,
          // We don't pass 'async: true' here to avoid infinite loops,
          // though our orchestrator doesn't know about it yet.
        },
        store,
        {
          // Add default dependencies if needed
        }
      );
    },
    {
      connection: RedisService.getInstance(),
      concurrency: parseInt(process.env.AGENCY_WORKER_CONCURRENCY || '5', 10),
    }
  );

  worker.on('completed', (job: Job<EnqueueTaskPayload>) => {
    console.log(`Job ${job.id} (Task ${job.data.taskId}) completed successfully`);
  });

  worker.on('failed', (job: Job<EnqueueTaskPayload> | undefined, err: Error) => {
    console.error(`Job ${job?.id} (Task ${job?.data.taskId}) failed:`, err);
  });

  return worker;
}
