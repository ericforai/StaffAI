#!/usr/bin/env tsx
/**
 * Run a non-risky task through the lightweight execution service.
 *
 * This script demonstrates how to:
 * 1. Create a low-risk task that doesn't require approval
 * 2. Execute it through the runtime execution service
 */

import { Store } from '../src/store';
import { createTaskDraft } from '../src/orchestration/task-orchestrator';
import { executeTaskRecord } from '../src/orchestration/task-execution-orchestrator';

async function main() {
  console.log('🚀 Running lightweight task execution...\n');

  // Initialize the store (uses file-based persistence by default)
  const store = new Store();

  // Create a non-risky task (low risk, simple description)
  const taskInput = {
    title: 'Calculate 2 + 2',
    description: 'What is 2 plus 2? Provide a simple answer.',
    taskType: 'general',
    priority: 'low',
  };

  console.log('📝 Creating task...');
  console.log(`   Title: ${taskInput.title}`);
  console.log(`   Description: ${taskInput.description}\n`);

  const task = await createTaskDraft(taskInput, store);

  console.log(`✅ Task created with ID: ${task.id}`);
  console.log(`   Status: ${task.status}`);
  console.log(`   Risk Level: ${task.riskLevel}`);
  console.log(`   Approval Required: ${task.approvalRequired}`);
  console.log(`   Execution Mode: ${task.executionMode}\n`);

  if (task.approvalRequired) {
    console.log('❌ Task requires approval - skipping execution');
    return;
  }

  if (task.status !== 'routed' && task.status !== 'created') {
    console.log(`❌ Task is not executable in current state: ${task.status}`);
    return;
  }

  console.log('⚡ Executing task...');
  const startTime = Date.now();

  try {
    const result = await executeTaskRecord(
      task,
      {
        executor: 'claude',
        summary: `Calculate: ${taskInput.title}`,
        timeoutMs: 30000, // 30 seconds
        maxRetries: 1,
      },
      store,
      {
        // No memory context for simple tasks
        loadMemoryContext: async () => undefined,
        // No summary writeback for demo
        writeExecutionSummary: async () => {},
        // Sampling not required for simple execution
        sessionCapabilities: { sampling: false },
      }
    );

    const duration = Date.now() - startTime;

    console.log('\n✅ Execution completed!\n');
    console.log('📊 Execution Details:');
    console.log(`   Execution ID: ${result.execution.id}`);
    console.log(`   Display ID: ${result.execution.displayExecutionId}`);
    console.log(`   Status: ${result.execution.status}`);
    console.log(`   Executor: ${result.execution.executor}`);
    console.log(`   Runtime: ${result.execution.runtimeName}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Retries: ${result.execution.retryCount}/${result.execution.maxRetries}`);
    console.log(`   Degraded: ${result.execution.degraded ? 'Yes' : 'No'}\n`);

    console.log('📤 Output Summary:');
    console.log('   ' + '='.repeat(70));
    console.log(`   ${result.execution.outputSummary}`);
    console.log('   ' + '='.repeat(70) + '\n');

    if (result.execution.status === 'failed') {
      console.log('❌ Error Details:');
      console.log(`   Error: ${result.execution.errorMessage}`);
      if (result.execution.structuredError) {
        console.log(`   Code: ${result.execution.structuredError.code}`);
        console.log(`   Retriable: ${result.execution.structuredError.retriable}`);
      }
    }

    console.log(`📝 Task Status: ${result.task.status}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ Execution failed after ${duration}ms`);
    console.error(error);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
