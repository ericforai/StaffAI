#!/usr/bin/env tsx
/**
 * Demonstration of various lightweight execution scenarios.
 *
 * This script shows different task types and their execution behavior.
 */

import { Store } from '../src/store';
import { createTaskDraft, routeTask, validateTaskDraft } from '../src/orchestration/task-orchestrator';
import { executeTaskRecord } from '../src/orchestration/task-execution-orchestrator';

interface Scenario {
  name: string;
  input: {
    title: string;
    description: string;
    taskType?: string;
    priority?: string;
  };
  expectedRiskLevel: 'low' | 'medium' | 'high';
  expectedApprovalRequired: boolean;
}

const scenarios: Scenario[] = [
  {
    name: 'Simple Calculation',
    input: {
      title: 'Calculate 5 + 3',
      description: 'What is 5 plus 3?',
    },
    expectedRiskLevel: 'low',
    expectedApprovalRequired: false,
  },
  {
    name: 'Documentation Task',
    input: {
      title: 'Document API endpoint',
      description: 'Write documentation for the GET /api/tasks endpoint',
      taskType: 'documentation',
      priority: 'low',
    },
    expectedRiskLevel: 'low',
    expectedApprovalRequired: false,
  },
  {
    name: 'Code Explanation',
    input: {
      title: 'Explain TypeScript generics',
      description: 'Explain what generics are in TypeScript with a simple example',
    },
    expectedRiskLevel: 'low',
    expectedApprovalRequired: false,
  },
  {
    name: 'Research Task',
    input: {
      title: 'Research best practices',
      description: 'What are the best practices for TypeScript error handling?',
    },
    expectedRiskLevel: 'low',
    expectedApprovalRequired: false,
  },
  {
    name: 'High Risk - Contains Delete',
    input: {
      title: 'Delete production data',
      description: 'Delete all records from the users table',
    },
    expectedRiskLevel: 'high',
    expectedApprovalRequired: true,
  },
  {
    name: 'Medium Risk - Backend Implementation',
    input: {
      title: 'Implement authentication',
      description: 'Add JWT authentication to the API',
      taskType: 'backend_implementation',
    },
    expectedRiskLevel: 'medium',
    expectedApprovalRequired: true,
  },
];

async function runScenario(store: Store, scenario: Scenario, index: number) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Scenario ${index + 1}: ${scenario.name}`);
  console.log('='.repeat(70));

  // Validate input
  const validation = validateTaskDraft(scenario.input);
  if (!validation.valid) {
    console.log(`❌ Validation failed: ${validation.error}`);
    return;
  }

  // Show input
  console.log('\n📝 Task Input:');
  console.log(`   Title: ${scenario.input.title}`);
  console.log(`   Description: ${scenario.input.description}`);
  console.log(`   Task Type: ${scenario.input.taskType || 'general'}`);
  console.log(`   Priority: ${scenario.input.priority || 'medium'}`);

  // Route the task
  const routeDecision = routeTask(scenario.input);
  console.log('\n🧭 Routing Decision:');
  console.log(`   Task Type: ${routeDecision.taskType}`);
  console.log(`   Execution Mode: ${routeDecision.executionMode}`);
  console.log(`   Agent Role: ${routeDecision.recommendedAgentRole}`);
  console.log(`   Reason: ${routeDecision.reason}`);

  // Create the task
  const task = await createTaskDraft(scenario.input, store);

  console.log('\n✅ Task Created:');
  console.log(`   Task ID: ${task.id}`);
  console.log(`   Status: ${task.status}`);
  console.log(`   Risk Level: ${task.riskLevel}`);
  console.log(`   Approval Required: ${task.approvalRequired}`);

  // Validate expectations
  const riskMatch = task.riskLevel === scenario.expectedRiskLevel;
  const approvalMatch = task.approvalRequired === scenario.expectedApprovalRequired;

  console.log('\n🔍 Expectation Check:');
  console.log(`   Risk Level: ${riskMatch ? '✅' : '❌'} (expected: ${scenario.expectedRiskLevel})`);
  console.log(`   Approval: ${approvalMatch ? '✅' : '❌'} (expected: ${scenario.expectedApprovalRequired})`);

  // Execute if not requiring approval
  if (!task.approvalRequired) {
    console.log('\n⚡ Executing task...');

    try {
      const startTime = Date.now();
      const result = await executeTaskRecord(
        task,
        {
          executor: 'claude',
          summary: `${scenario.name}: ${task.title}`,
          timeoutMs: 30000,
          maxRetries: 1,
        },
        store,
        {
          loadMemoryContext: async () => undefined,
          writeExecutionSummary: async () => {},
          sessionCapabilities: { sampling: false },
        }
      );
      const duration = Date.now() - startTime;

      console.log(`\n✅ Execution completed in ${duration}ms`);
      console.log(`   Status: ${result.execution.status}`);
      console.log(`   Executor: ${result.execution.executor}`);
      console.log(`   Degraded: ${result.execution.degraded ? 'Yes' : 'No'}`);

      if (result.execution.status === 'completed') {
        console.log('\n📤 Output:');
        console.log('   ' + '-'.repeat(66));
        const summary = result.execution.outputSummary;
        const truncated = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
        console.log(`   ${truncated}`);
        console.log('   ' + '-'.repeat(66));
      } else if (result.execution.status === 'failed') {
        console.log(`\n❌ Execution failed: ${result.execution.errorMessage}`);
      }
    } catch (error) {
      console.log(`\n❌ Execution error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log('\n⏸️  Task requires approval - skipping execution');
    console.log('    Use the approval workflow to execute this task');
  }

  // Small delay between scenarios
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function main() {
  console.log('🚀 Lightweight Execution Scenarios Demo\n');
  console.log('This demo shows different task types and how the risk assessment');
  console.log('and approval requirements work.\n');

  const store = new Store();

  // Run each scenario
  for (let i = 0; i < scenarios.length; i++) {
    await runScenario(store, scenarios[i], i);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 Summary');
  console.log('='.repeat(70));

  const tasks = await store.getTasks();
  const lowRisk = tasks.filter((t) => t.riskLevel === 'low').length;
  const mediumRisk = tasks.filter((t) => t.riskLevel === 'medium').length;
  const highRisk = tasks.filter((t) => t.riskLevel === 'high').length;
  const requiresApproval = tasks.filter((t) => t.approvalRequired).length;

  console.log(`\nTotal Tasks Created: ${tasks.length}`);
  console.log(`  Low Risk: ${lowRisk}`);
  console.log(`  Medium Risk: ${mediumRisk}`);
  console.log(`  High Risk: ${highRisk}`);
  console.log(`  Requires Approval: ${requiresApproval}`);
  console.log(`  Can Execute Directly: ${tasks.length - requiresApproval}`);

  console.log('\n💡 Key Takeaways:');
  console.log('  1. Simple tasks with safe keywords are low risk');
  console.log('  2. Low risk tasks do NOT require approval');
  console.log('  3. Tasks with dangerous keywords (delete, deploy) require approval');
  console.log('  4. Complex task types (backend_implementation) require approval');
  console.log('  5. Lightweight execution is perfect for low-risk tasks\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
