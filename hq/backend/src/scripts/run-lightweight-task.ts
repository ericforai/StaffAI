#!/usr/bin/env ts-node
/**
 * Run a non-risky task through the lightweight execution service.
 * This demonstrates using the execution service with a simulated runtime runner.
 */

import { randomUUID } from 'node:crypto';
import { runTaskExecution } from '../runtime/execution-service';
import { Store } from '../store';

/**
 * Simulates a lightweight execution that doesn't call any external services.
 * This is safe for testing and demonstration purposes.
 */
async function simulateLightweightExecution(context: {
  task: { title: string; description: string };
  summary: string;
  timeoutMs: number;
}): Promise<{
  outputSummary: string;
  outputSnapshot: {
    runtimeName: string;
    executor: string;
    executionMode: string;
    tokensUsed: number;
    responseTimeMs: number;
    simulated: true;
  };
}> {
  const startTime = Date.now();

  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 100));

  const responseTimeMs = Date.now() - startTime;

  return {
    outputSummary: `Task completed: ${context.task.title}\n\n${context.summary}`,
    outputSnapshot: {
      runtimeName: 'simulated_lightweight',
      executor: 'claude',
      executionMode: 'single',
      tokensUsed: 0,
      responseTimeMs,
      simulated: true,
    },
  };
}

/**
 * Create a non-risky task for demonstration.
 */
function createNonRiskyTask() {
  const taskId = randomUUID();
  return {
    id: taskId,
    title: 'Summarize the benefits of TypeScript',
    description: 'Write a brief summary of why TypeScript is beneficial for large projects',
    taskType: 'general' as const,
    priority: 'low' as const,
    status: 'created' as const,
    executionMode: 'single' as const,
    approvalRequired: false,
    riskLevel: 'low' as const,
    requestedBy: 'demo',
    requestedAt: new Date().toISOString(),
    recommendedAgentRole: 'dispatcher',
    candidateAgentRoles: ['dispatcher'],
    routeReason: 'Demonstration task',
    routingStatus: 'matched' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Main execution function.
 */
async function main() {
  console.log('🚀 Starting lightweight task execution demo\n');

  // Set environment variable for in-memory persistence
  process.env.AGENCY_PERSISTENCE_MODE = 'memory';

  // Create an in-memory store for this demonstration
  const store = new Store();

  // Create a non-risky task
  const task = createNonRiskyTask();
  console.log('📝 Created task:');
  console.log(`   ID: ${task.id}`);
  console.log(`   Title: ${task.title}`);
  console.log(`   Risk Level: ${task.riskLevel}`);
  console.log(`   Approval Required: ${task.approvalRequired}\n`);

  // Save the task to the store
  await store.saveTask(task);

  // Execute the task through the lightweight execution service
  console.log('⚡ Executing task through lightweight execution service...\n');

  const result = await runTaskExecution(
    {
      taskId: task.id,
      executor: 'claude',
      summary: task.description,
      executionMode: 'single',
      timeoutMs: 5000,
      maxRetries: 1,
      task,
      // Use a simulated runtime runner for safety
      runtimeRunner: simulateLightweightExecution,
    },
    store
  );

  // Display results
  console.log('✅ Execution completed!\n');
  console.log('📊 Execution Details:');
  console.log(`   Execution ID: ${result.execution.id}`);
  console.log(`   Status: ${result.execution.status}`);
  console.log(`   Executor: ${result.execution.executor}`);
  console.log(`   Runtime: ${result.execution.runtimeName}`);
  console.log(`   Started: ${result.execution.startedAt}`);
  console.log(`   Completed: ${result.execution.completedAt}`);

  if (result.execution.outputSnapshot) {
    const snapshot = result.execution.outputSnapshot as { responseTimeMs?: number; simulated?: boolean };
    console.log(`   Response Time: ${snapshot.responseTimeMs}ms`);
    console.log(`   Simulated: ${snapshot.simulated ?? false}`);
  }

  console.log('\n📄 Output Summary:');
  console.log('---');
  console.log(result.execution.outputSummary);
  console.log('---\n');

  // Verify the task was updated
  const updatedTask = await store.getTaskById(task.id);
  console.log('🔄 Task Status Update:');
  console.log(`   Previous Status: created`);
  console.log(`   Current Status: ${updatedTask?.status}\n`);

  // Retrieve the execution record
  const execution = await store.getExecutionById(result.execution.id);
  console.log('💾 Persistence Check:');
  console.log(`   Execution saved: ${execution ? '✅' : '❌'}`);
  console.log(`   Total executions in store: ${(await store.getExecutions()).length}\n`);

  console.log('🎉 Demo completed successfully!');
}

// Run the demo
main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
