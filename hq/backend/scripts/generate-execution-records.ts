/**
 * Generate Execution Records for History Endpoint
 *
 * This script creates realistic execution records for testing/demonstration
 * of the execution history API endpoint.
 *
 * Usage:
 *   npx ts-node scripts/generate-execution-records.ts [--count 10]
 */

import type { ExecutionRecord, TaskRecord, ToolCallLog } from '../src/shared/task-types';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXECUTION_STATUSES = ['pending', 'running', 'paused', 'cancelled', 'completed', 'failed', 'degraded'] as const;
type ExecutionStatus = typeof EXECUTION_STATUSES[number];

const EXECUTORS = ['claude', 'codex', 'openai'] as const;
type Executor = typeof EXECUTORS[number];

const ASSIGNMENT_ROLES = ['primary', 'secondary', 'reviewer', 'dispatcher'] as const;
type AssignmentRole = typeof ASSIGNMENT_ROLES[number];

const AGENTS = [
  'frontend-developer',
  'backend-developer',
  'code-reviewer',
  'qa-specialist',
  'product-manager',
  'ux-designer',
  'devops-engineer',
];

const TASK_TYPES = [
  'architecture',
  'architecture_analysis',
  'backend_implementation',
  'backend_design',
  'code_review',
  'documentation',
  'workflow_dispatch',
  'frontend_implementation',
  'quality_assurance',
  'general',
] as const;

interface GenerationOptions {
  count: number;
  taskIdPrefix: string;
  executionIdPrefix: string;
}

function generateId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index.toString().padStart(4, '0')}`;
}

function randomItem<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDate(startDaysAgo: number, endDaysAgo: number): string {
  const now = Date.now();
  const start = now - startDaysAgo * 24 * 60 * 60 * 1000;
  const end = now - endDaysAgo * 24 * 60 * 60 * 1000;
  const timestamp = start + Math.random() * (end - start);
  return new Date(timestamp).toISOString();
}

function generateExecutionRecord(
  index: number,
  opts: GenerationOptions,
  prevTasks?: TaskRecord[],
): ExecutionRecord {
  const status = randomItem(EXECUTION_STATUSES);
  const executor = randomItem(EXECUTORS);
  const agentId = randomItem(AGENTS);
  const taskType = randomItem(TASK_TYPES);

  // Create associated task
  const taskId = generateId(opts.taskIdPrefix, index);
  const task: TaskRecord = {
    id: taskId,
    title: `${taskType.replace('_', ' ')} task ${index + 1}`,
    description: `Sample ${taskType} task for execution history testing`,
    taskType,
    priority: randomItem(['low', 'medium', 'high', 'urgent']),
    status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'running',
    executionMode: randomItem(['single', 'serial', 'parallel', 'advanced_discussion']),
    approvalRequired: Math.random() > 0.7,
    riskLevel: randomItem(['low', 'medium', 'high']),
    requestedBy: 'user-' + Math.floor(Math.random() * 10),
    requestedAt: randomDate(7, 5),
    recommendedAgentRole: agentId,
    candidateAgentRoles: [agentId],
    routeReason: `Auto-routed to ${agentId} based on task type`,
    routingStatus: 'matched',
    createdAt: randomDate(7, 5),
    updatedAt: randomDate(2, 0),
  };

  const startedAt = randomDate(5, 3);
  const endedAt = ['completed', 'failed', 'cancelled'].includes(status)
    ? randomDate(3, 1)
    : undefined;
  const completedAt = status === 'completed' ? endedAt : undefined;

  const execution: ExecutionRecord = {
    id: generateId(opts.executionIdPrefix, index),
    taskId,
    status,
    executor,
    runtimeName: executor === 'claude' ? 'claude-desktop-app' : executor === 'codex' ? 'codex-cli' : 'openai-api',
    degraded: status === 'degraded',
    retryCount: status === 'failed' ? Math.floor(Math.random() * 3) : 0,
    maxRetries: 3,
    timeoutMs: 300000,
    assignmentId: `assign-${index}`,
    assignmentRole: randomItem(ASSIGNMENT_ROLES),
    inputSnapshot: {
      task: task.title,
      description: task.description,
      agentId,
      mode: task.executionMode,
    },
    outputSnapshot: status === 'completed'
      ? {
          result: `Successfully completed ${taskType} task`,
          summary: `Task executed by ${executor} on ${agentId}`,
          artifacts: [`artifact-${index}-1.txt`, `artifact-${index}-2.json`],
        }
      : undefined,
    structuredError: status === 'failed'
      ? {
          code: randomItem(['timeout', 'runtime_unavailable', 'execution_failed', 'degraded', 'unknown']),
          message: `Execution failed: ${randomItem(['Network timeout', 'Agent unavailable', 'Invalid input', 'Runtime error'])}`,
          retriable: Math.random() > 0.5,
          details: {
            attempt: 1,
            lastError: 'Details about the error',
          },
        }
      : undefined,
    outputSummary: status === 'completed'
      ? `Completed ${taskType} analysis and generated recommendations`
      : status === 'failed'
        ? `Failed during execution: see structuredError for details`
        : status === 'running'
          ? `Currently processing ${taskType} task`
          : `Execution ${status}`,
    errorMessage: status === 'failed' ? 'Execution failed due to runtime error' : undefined,
    memoryContextExcerpt: Math.random() > 0.5
      ? `Retrieved 3 knowledge entries from previous ${taskType} tasks`
      : undefined,
    startedAt,
    endedAt,
    completedAt,
  };

  return execution;
}

function generateToolCallLogs(executionId: string, count: number = 3): ToolCallLog[] {
  const tools = ['read_file', 'write_file', 'bash', 'web_search', 'agent_invoke'];
  const statuses: Array<'pending' | 'running' | 'completed' | 'failed' | 'blocked'> = ['pending', 'running', 'completed', 'failed', 'blocked'];

  return Array.from({ length: count }, (_, i) => ({
    id: `tool-${executionId}-${i}`,
    toolName: randomItem(tools),
    actorRole: randomItem(AGENTS),
    riskLevel: randomItem(['low', 'medium', 'high']),
    taskId: executionId.split('-')[0],
    executionId,
    status: randomItem(statuses),
    inputSummary: `Tool call ${i + 1} input`,
    outputSummary: `Tool call ${i + 1} output`,
    createdAt: randomDate(4, 2),
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const countArg = args.findIndex((a) => a === '--count');
  const count = countArg >= 0 && args[countArg + 1] ? Number.parseInt(args[countArg + 1], 10) : 10;

  const opts: GenerationOptions = {
    count,
    taskIdPrefix: 'task',
    executionIdPrefix: 'exec',
  };

  console.log(`Generating ${count} execution records...`);

  const executions: ExecutionRecord[] = [];
  const tasks: TaskRecord[] = [];
  const toolCallsMap: Map<string, ToolCallLog[]> = new Map();

  for (let i = 0; i < count; i++) {
    const execution = generateExecutionRecord(i, opts, tasks);
    executions.push(execution);

    // Extract task from execution context
    const task: TaskRecord = {
      id: execution.taskId,
      title: `Task ${i + 1}`,
      description: `Test task ${i + 1}`,
      taskType: randomItem(TASK_TYPES),
      priority: randomItem(['low', 'medium', 'high', 'urgent']),
      status: execution.status === 'completed' ? 'completed' : execution.status === 'failed' ? 'failed' : 'running',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      requestedBy: 'test-user',
      requestedAt: execution.startedAt || new Date().toISOString(),
      recommendedAgentRole: 'frontend-developer',
      candidateAgentRoles: ['frontend-developer'],
      routeReason: 'Test generation',
      routingStatus: 'matched',
      createdAt: execution.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(task);

    // Generate tool calls for completed/failed executions
    if (['completed', 'failed'].includes(execution.status)) {
      const toolCalls = generateToolCallLogs(execution.id, Math.floor(Math.random() * 5) + 1);
      toolCallsMap.set(execution.id, toolCalls);
    }
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), 'generated-test-data');
  await mkdir(outputDir, { recursive: true });

  // Write files
  await Promise.all([
    writeFile(
      path.join(outputDir, 'executions.json'),
      JSON.stringify(executions, null, 2),
      'utf-8',
    ),
    writeFile(
      path.join(outputDir, 'tasks.json'),
      JSON.stringify(tasks, null, 2),
      'utf-8',
    ),
    writeFile(
      path.join(outputDir, 'tool-calls.json'),
      JSON.stringify(Object.fromEntries(toolCallsMap), null, 2),
      'utf-8',
    ),
  ]);

  console.log(`\n✓ Generated ${count} execution records`);
  console.log(`✓ Generated ${tasks.length} task records`);
  console.log(`✓ Generated ${toolCallsMap.size} tool call groups`);
  console.log(`\nOutput written to: ${outputDir}/`);

  // Summary statistics
  const statusCounts: Record<string, number> = {};
  const executorCounts: Record<string, number> = {};

  for (const exec of executions) {
    statusCounts[exec.status] = (statusCounts[exec.status] || 0) + 1;
    if (exec.executor) {
      executorCounts[exec.executor] = (executorCounts[exec.executor] || 0) + 1;
    }
  }

  console.log('\nExecution Status Distribution:');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\nExecutor Distribution:');
  for (const [executor, count] of Object.entries(executorCounts)) {
    console.log(`  ${executor}: ${count}`);
  }

  console.log('\nExample GET /api/executions queries:');
  console.log(`  curl http://localhost:3333/api/executions`);
  console.log(`  curl http://localhost:3333/api/executions?status=completed`);
  console.log(`  curl http://localhost:3333/api/executions?executor=claude&limit=5`);
  console.log(`  curl http://localhost:3333/api/executions?fields=id,status,executor,startedAt`);
}

main().catch((error) => {
  console.error('Error generating execution records:', error);
  process.exit(1);
});
