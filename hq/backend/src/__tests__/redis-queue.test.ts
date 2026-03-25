import test from 'node:test';
import assert from 'node:assert/strict';
import { closeTaskExecutionQueue, enqueueTaskExecution } from '../infrastructure/task-queue';
import { startTaskWorker } from '../infrastructure/worker';
import { RedisService } from '../infrastructure/redis-service';
import { Store } from '../store';
import type { TaskRecord } from '../shared/task-types';

/**
 * Redis Queue Integration Test
 * 
 * Verifies that tasks can be enqueued and processed by the background worker.
 */

test('Redis Queue: Enqueue and Process Task', async () => {
  if (process.env.AGENCY_ENABLE_REDIS_TESTS !== '1') {
    console.log('Skipping Redis queue test: set AGENCY_ENABLE_REDIS_TESTS=1 to run');
    return;
  }

  if (!process.env.REDIS_URL) {
    console.log('Skipping Redis queue test: REDIS_URL not configured');
    return;
  }

  // Use memory mode for store to avoid DB dependencies during queue test
  process.env.AGENCY_PERSISTENCE_MODE = 'memory';
  const store = new Store();
  
  // Create a mock task in the store
  const mockTask: TaskRecord = {
    id: 'test-async-task-' + Date.now(),
    title: 'Test Async Task',
    description: 'Testing Redis queue processing',
    taskType: 'general',
    priority: 'medium',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'test-user',
    requestedAt: new Date().toISOString(),
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: [],
    routeReason: 'test',
    routingStatus: 'matched',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.saveTask(mockTask);

  // Start the worker
  const worker = startTaskWorker(store);

  try {
    // Enqueue the task
    await enqueueTaskExecution({
      taskId: mockTask.id,
      executor: 'claude',
      summary: 'Running test task',
    });

    // Wait for the worker to process the task
    // Since we're in a test, we'll poll the store for status change
    let iterations = 0;
    let completed = false;
    while (iterations < 20) {
      const updatedTask = await store.getTaskById(mockTask.id);
      if (updatedTask && (updatedTask.status === 'completed' || updatedTask.status === 'running')) {
        completed = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      iterations++;
    }

    assert.ok(completed, 'Task should have been picked up or completed by the worker');
  } finally {
    // Cleanup
    await worker.close();
    await closeTaskExecutionQueue();
    await RedisService.shutdown();
  }
});
