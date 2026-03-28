#!/usr/bin/env tsx
/**
 * Verify and display details of the lightweight execution.
 *
 * This script shows how to retrieve task and execution details after execution.
 */

import { Store } from '../src/store';

async function main() {
  console.log('🔍 Verifying lightweight execution...\n');

  const store = new Store();

  // Get the most recent task
  const tasks = await store.getTasks();
  const latestTask = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!latestTask) {
    console.log('❌ No completed tasks found');
    return;
  }

  console.log('📝 Latest Completed Task:');
  console.log(`   ID: ${latestTask.id}`);
  console.log(`   Title: ${latestTask.title}`);
  console.log(`   Description: ${latestTask.description}`);
  console.log(`   Status: ${latestTask.status}`);
  console.log(`   Created: ${latestTask.createdAt}`);
  console.log(`   Updated: ${latestTask.updatedAt}\n`);

  // Get executions for this task
  const executions = await store.getExecutionsByTaskId(latestTask.id);
  const latestExecution = executions.sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt)
  )[0];

  if (!latestExecution) {
    console.log('❌ No executions found for this task');
    return;
  }

  console.log('⚡ Latest Execution:');
  console.log(`   Execution ID: ${latestExecution.id}`);
  console.log(`   Display ID: ${latestExecution.displayExecutionId}`);
  console.log(`   Status: ${latestExecution.status}`);
  console.log(`   Executor: ${latestExecution.executor}`);
  console.log(`   Runtime: ${latestExecution.runtimeName}`);
  console.log(`   Started: ${latestExecution.startedAt}`);
  console.log(`   Completed: ${latestExecution.completedAt}`);
  console.log(`   Degraded: ${latestExecution.degraded ? 'Yes' : 'No'}`);
  console.log(`   Retries: ${latestExecution.retryCount}/${latestExecution.maxRetries}\n`);

  console.log('📤 Output:');
  console.log('   ' + '='.repeat(70));
  console.log(`   ${latestExecution.outputSummary}`);
  console.log('   ' + '='.repeat(70) + '\n');

  // Get workflow plan and assignments if present
  const workflowPlan = await store.getWorkflowPlanByTaskId(latestTask.id);
  const assignments = await store.getTaskAssignmentsByTaskId(latestTask.id);

  if (workflowPlan || assignments.length > 0) {
    console.log('📋 Workflow Artifacts:');
    if (workflowPlan) {
      console.log(`   Plan ID: ${workflowPlan.id}`);
      console.log(`   Plan Mode: ${workflowPlan.mode}`);
      console.log(`   Plan Status: ${workflowPlan.status}`);
      console.log(`   Steps: ${workflowPlan.steps.length}`);
    }
    if (assignments.length > 0) {
      console.log(`   Assignments: ${assignments.length}`);
      assignments.forEach((a, i) => {
        console.log(`     ${i + 1}. ${a.agentId} (${a.assignmentRole}): ${a.status}`);
      });
    }
    console.log();
  }

  // Get execution trace events if available
  const storeWithTrace = store as Store & {
    getExecutionTraceEventsByExecutionId?: (id: string) => Promise<any[]>;
  };

  if (typeof storeWithTrace.getExecutionTraceEventsByExecutionId === 'function') {
    const traceEvents = await storeWithTrace.getExecutionTraceEventsByExecutionId(
      latestExecution.id
    );

    if (traceEvents.length > 0) {
      console.log('📜 Execution Trace:');
      traceEvents.forEach((event, i) => {
        console.log(`   ${i + 1}. [${event.type}] ${event.summary}`);
        console.log(`      At: ${event.occurredAt}`);
        console.log(`      By: ${event.actor}`);
      });
      console.log();
    }
  }

  // Get cost logs if available
  const storeWithCost = store as Store & {
    getCostLogsByExecutionId?: (id: string) => Promise<any[]>;
  };

  if (typeof storeWithCost.getCostLogsByExecutionId === 'function') {
    const costLogs = await storeWithCost.getCostLogsByExecutionId(latestExecution.id);

    if (costLogs.length > 0) {
      console.log('💰 Cost Logs:');
      costLogs.forEach((log) => {
        console.log(`   Tokens Used: ${log.tokensUsed}`);
        if (log.modelVersion) {
          console.log(`   Model: ${log.modelVersion}`);
        }
        if (log.responseTimeMs) {
          console.log(`   Response Time: ${log.responseTimeMs}ms`);
        }
      });
      console.log();
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
