/**
 * Lightweight Execution Service Test
 *
 * Demonstrates running a non-risky task through the lightweight execution service.
 * A "non-risky" task has:
 * - riskLevel: 'low'
 * - approvalRequired: false
 *
 * The lightweight execution path uses runTaskExecution directly with a mock
 * runtime runner, avoiding full API overhead.
 */

import { randomUUID } from 'node:crypto';
import { runTaskExecution, type ExecutionLifecycleRecord } from './dist/runtime/execution-service.js';
import type { TaskRecord } from './dist/shared/task-types.js';

// Mock store for testing
class MockStore {
  private executions: Map<string, ExecutionLifecycleRecord> = new Map();
  private tasks: Map<string, TaskRecord> = new Map();

  constructor() {
    // Initialize with a test task
    const task: TaskRecord = {
      id: 'task-lightweight-test',
      title: 'Test lightweight execution',
      description: 'A simple non-risky task for testing',
      taskType: 'general',
      priority: 'medium',
      status: 'created',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      requestedBy: 'test-user',
      requestedAt: new Date().toISOString(),
      recommendedAgentRole: 'dispatcher',
      candidateAgentRoles: ['dispatcher'],
      routeReason: 'test',
      routingStatus: 'matched',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
  }

  async saveExecution(execution: ExecutionLifecycleRecord): Promise<void> {
    this.executions.set(execution.id, execution);
    console.log(`[Store] Saved execution: ${execution.id} (status: ${execution.status})`);
  }

  async updateExecution(
    id: string,
    updater: (execution: ExecutionLifecycleRecord) => ExecutionLifecycleRecord
  ): Promise<ExecutionLifecycleRecord | null> {
    const current = this.executions.get(id);
    if (!current) return null;
    const updated = updater(current);
    this.executions.set(id, updated);
    console.log(`[Store] Updated execution: ${id} (status: ${updated.status})`);
    return updated;
  }

  async updateTask(
    id: string,
    updater: (task: TaskRecord) => TaskRecord
  ): Promise<TaskRecord | null> {
    const current = this.tasks.get(id);
    if (!current) return null;
    const updated = updater(current);
    this.tasks.set(id, updated);
    console.log(`[Store] Updated task: ${id} (status: ${updated.status})`);
    return updated;
  }

  getExecution(id: string): ExecutionLifecycleRecord | undefined {
    return this.executions.get(id);
  }

  getTask(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  async getExecutions(): Promise<ExecutionLifecycleRecord[]> {
    return Array.from(this.executions.values());
  }
}

/**
 * Mock runtime runner that simulates successful execution
 * without making actual external API calls
 */
async function mockRuntimeRunner() {
  console.log('[Runtime] Starting mock execution...');
  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    outputSummary: 'Task completed successfully via lightweight execution service',
    outputSnapshot: {
      runtimeName: 'mock-runtime',
      executor: 'claude',
      executionMode: 'single',
      completedAt: new Date().toISOString(),
      mockExecution: true,
    },
  };
}

/**
 * Run a non-risky task through the lightweight execution service
 */
async function runNonRiskyTask() {
  console.log('=== Lightweight Execution Service Test ===\n');

  const store = new MockStore();
  const task = store.getTask('task-lightweight-test')!;

  console.log('Task Details:');
  console.log(`  ID: ${task.id}`);
  console.log(`  Title: ${task.title}`);
  console.log(`  Risk Level: ${task.riskLevel}`);
  console.log(`  Approval Required: ${task.approvalRequired}`);
  console.log(`  Execution Mode: ${task.executionMode}\n`);

  console.log('Starting execution...\n');

  const startTime = Date.now();

  try {
    const result = await runTaskExecution(
      {
        taskId: task.id,
        executor: 'claude',
        summary: task.description,
        executionMode: 'single',
        task,
        timeoutMs: 5000,
        maxRetries: 1,
        runtimeRunner: mockRuntimeRunner,
      },
      store
    );

    const elapsed = Date.now() - startTime;

    console.log('\n=== Execution Result ===');
    console.log(`Status: ${result.execution.status}`);
    console.log(`Execution ID: ${result.execution.id}`);
    console.log(`Display ID: ${result.execution.displayExecutionId}`);
    console.log(`Executor: ${result.execution.executor}`);
    console.log(`Runtime: ${result.execution.runtimeName}`);
    console.log(`Output Summary: ${result.execution.outputSummary}`);
    console.log(`Retry Count: ${result.execution.retryCount}/${result.execution.maxRetries}`);
    console.log(`Elapsed Time: ${elapsed}ms`);
    console.log(`Started At: ${result.execution.startedAt}`);
    console.log(`Completed At: ${result.execution.completedAt}`);

    if (result.execution.outputSnapshot) {
      console.log(`\nOutput Snapshot:`);
      console.log(JSON.stringify(result.execution.outputSnapshot, null, 2));
    }

    console.log('\n=== Task Status ===');
    console.log(`Task ID: ${result.task?.id}`);
    console.log(`Task Status: ${result.task?.status}`);

    // Verify success
    if (result.execution.status === 'completed') {
      console.log('\n✅ SUCCESS: Non-risky task executed successfully!');
    } else {
      console.log(`\n❌ FAILED: Task execution ended with status: ${result.execution.status}`);
      if (result.execution.errorMessage) {
        console.log(`Error: ${result.execution.errorMessage}`);
      }
    }

    return result;
  } catch (error) {
    console.error('\n❌ ERROR: Execution failed with exception:', error);
    throw error;
  }
}

// Run the test
runNonRiskyTask()
  .then(() => {
    console.log('\n=== Test Complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n=== Test Failed ===');
    console.error(error);
    process.exit(1);
  });
