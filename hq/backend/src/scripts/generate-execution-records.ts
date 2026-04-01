import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExecutionRecord, TaskRecord } from '../shared/task-types';

interface GenerateOptions {
  count: number;
  taskId?: string;
  outputFile?: string;
  daysBack?: number;
  /** Write directly into the Store (executions.json) — skips existing records */
  persist?: boolean;
}

/**
 * Generate a random execution record with realistic data
 */
function generateExecutionRecord(
  index: number,
  taskId: string,
  baseDate: Date,
): ExecutionRecord {
  const statuses: ExecutionRecord['status'][] = [
    'completed',
    'failed',
    'cancelled',
    'paused',
    'running',
    'pending',
    'degraded',
  ];

  const executors: NonNullable<ExecutionRecord['executor']>[] = ['claude', 'codex', 'openai'];

  const runtimeNames = ['claude-3.5', 'claude-3.7', 'codex-gpt4', 'openai-gpt4'];

  // Weight status distribution (more completed than failed)
  const statusWeights = [0.5, 0.15, 0.1, 0.05, 0.1, 0.05, 0.05];
  const totalWeight = statusWeights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  let statusIndex = 0;
  for (let i = 0; i < statusWeights.length; i++) {
    random -= statusWeights[i];
    if (random <= 0) {
      statusIndex = i;
      break;
    }
  }

  const status = statuses[statusIndex];
  const executor = executors[Math.floor(Math.random() * executors.length)];
  const runtimeName = runtimeNames[Math.floor(Math.random() * runtimeNames.length)];

  // Generate timestamps relative to base date
  const minutesBack = index * 30 + Math.floor(Math.random() * 60);
  const startedAt = new Date(baseDate.getTime() - minutesBack * 60 * 1000);

  // Calculate duration based on status
  let durationMinutes = 1 + Math.floor(Math.random() * 30);
  let endedAt: string | undefined;
  let completedAt: string | undefined;

  if (['completed', 'failed', 'cancelled'].includes(status)) {
    endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000).toISOString();
    completedAt = endedAt;
  } else if (status === 'paused') {
    endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000).toISOString();
  }

  const executionId = randomUUID();
  const displayExecutionId = `EXEC-${String(index + 1).padStart(4, '0')}`;

  // Generate structured error for failed executions
  let structuredError: ExecutionRecord['structuredError'];
  if (status === 'failed') {
    const codes = ['timeout', 'runtime_unavailable', 'execution_failed', 'degraded', 'unknown'] as const;
    const code = codes[Math.floor(Math.random() * codes.length)];
    structuredError = {
      code,
      message: generateErrorMessage(code),
      retriable: code !== 'unknown',
      details: {
        attempt: (Math.floor(Math.random() * 3) + 1).toString(),
        lastError: 'Process terminated with exit code 1',
      },
    };
  }

  // Generate output summary for completed executions
  let outputSummary: string | undefined;
  if (status === 'completed') {
    const summaries = [
      'Successfully completed task execution',
      'All workflow steps completed successfully',
      'Task execution completed with warnings',
      'Optimization completed: 3 files processed',
      'Code review completed: 12 suggestions provided',
      'Documentation generated successfully',
      'Database migration completed',
      'API integration test passed',
    ];
    outputSummary = summaries[Math.floor(Math.random() * summaries.length)];
  }

  return {
    id: executionId,
    displayExecutionId,
    taskId,
    status,
    executor,
    runtimeName,
    degraded: status === 'degraded',
    retryCount: status === 'failed' ? Math.floor(Math.random() * 3) : 0,
    maxRetries: 3,
    timeoutMs: 30000 + Math.floor(Math.random() * 120000),
    assignmentId: randomUUID(),
    assignmentRole: 'primary',
    workflowStepId: randomUUID(),
    workflowPlanId: randomUUID(),
    inputSnapshot: {
      taskType: 'general',
      priority: 'medium',
      description: `Test execution ${index + 1}`,
    },
    outputSnapshot: status === 'completed' || status === 'degraded' ? {
      result: 'success',
      metrics: {
        tokensUsed: 1000 + Math.floor(Math.random() * 5000),
        responseTimeMs: 500 + Math.floor(Math.random() * 5000),
      },
    } : undefined,
    structuredError,
    outputSummary,
    errorMessage: status === 'failed' ? structuredError?.message : undefined,
    memoryContextExcerpt: status === 'completed' ? 'Task completed successfully with all requirements met' : undefined,
    startedAt: startedAt.toISOString(),
    endedAt,
    completedAt,
  };
}

function generateErrorMessage(code: string): string {
  const messages: Record<string, string[]> = {
    timeout: [
      'Request timeout after 30s',
      'Execution exceeded maximum allowed time',
      'Upstream service timeout',
    ],
    runtime_unavailable: [
      'Runtime service unavailable',
      'Executor connection refused',
      'Runtime health check failed',
    ],
    execution_failed: [
      'Unhandled exception during execution',
      'Task execution terminated unexpectedly',
      'Runtime error in execution context',
    ],
    degraded: [
      'Execution completed with degraded performance',
      'Partial results due to rate limiting',
      'Fallback mode activated',
    ],
    unknown: [
      'Unknown execution error',
      'Unexpected failure condition',
      'Execution context corrupted',
    ],
  };

  const codeMessages = messages[code] || messages.unknown;
  return codeMessages[Math.floor(Math.random() * codeMessages.length)];
}

/**
 * Generate a mock task record for associating executions
 */
function generateTaskRecord(taskId: string): TaskRecord {
  const taskTypes: TaskRecord['taskType'][] = [
    'architecture',
    'backend_implementation',
    'code_review',
    'documentation',
    'frontend_implementation',
    'general',
    'quality_assurance',
  ];

  const priorities: TaskRecord['priority'][] = ['low', 'medium', 'high', 'urgent'];

  return {
    id: taskId,
    title: `Test Task ${taskId.slice(0, 8)}`,
    description: 'Generated test task for execution history',
    taskType: taskTypes[Math.floor(Math.random() * taskTypes.length)],
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    status: 'completed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'test-user',
    requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    recommendedAgentRole: 'general',
    candidateAgentRoles: ['general'],
    routeReason: 'Test task routing',
    routingStatus: 'matched',
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Main generation function
 */
export async function generateExecutionRecords(options: GenerateOptions): Promise<ExecutionRecord[]> {
  const {
    count,
    taskId: customTaskId,
    outputFile,
    daysBack = 7,
  } = options;

  // Use custom task ID or generate a new one
  const taskId = customTaskId || randomUUID();
  const baseDate = new Date();

  // Generate task record if no custom task ID provided
  const task = customTaskId ? null : generateTaskRecord(taskId);

  // Generate execution records
  const executions: ExecutionRecord[] = [];
  for (let i = 0; i < count; i++) {
    executions.push(generateExecutionRecord(i, taskId, baseDate));
  }

  // Sort by startedAt descending (most recent first)
  executions.sort((a, b) => {
    const aTime = new Date(a.startedAt || 0).getTime();
    const bTime = new Date(b.startedAt || 0).getTime();
    return bTime - aTime;
  });

  // Prepare output data
  const output = {
    ...(task ? { task } : {}),
    executions,
    summary: {
      total: executions.length,
      statusCounts: executions.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      executorCounts: executions.reduce((acc, e) => {
        if (e.executor) {
          acc[e.executor] = (acc[e.executor] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    },
  };

  // Write to file if specified
  if (outputFile) {
    const outputPath = path.resolve(outputFile);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Generated ${count} execution records -> ${outputPath}`);
  }

  return executions;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options: GenerateOptions = {
    count: 10,
    daysBack: 7,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--count':
      case '-c':
        options.count = parseInt(args[++i], 10);
        break;
      case '--task-id':
      case '-t':
        options.taskId = args[++i];
        break;
      case '--output':
      case '-o':
        options.outputFile = args[++i];
        break;
      case '--days':
      case '-d':
        options.daysBack = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        console.log(`
Generate Execution Records for History Endpoint

Usage: npm run generate:executions [options]

Options:
  -c, --count <number>       Number of execution records to generate (default: 10)
  -t, --task-id <uuid>       Use existing task ID instead of generating new one
  -o, --output <file>        Output file path (default: stdout JSON)
  -d, --days <number>        Time period in days to spread executions (default: 7)
  -h, --help                 Show this help message

Examples:
  npm run generate:executions -c 20 -o ./test-data/executions.json
  npm run generate:executions --count 50 --task-id abc-123-def
  npm run generate:executions -c 100 -d 30 -o executions.json
        `);
        process.exit(0);
    }
  }

  // Validate count
  if (options.count <= 0) {
    console.error('Error: count must be greater than 0');
    process.exit(1);
  }

  const executions = await generateExecutionRecords(options);

  // Output to stdout if no file specified
  if (!options.outputFile) {
    console.log(JSON.stringify(executions, null, 2));
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error generating execution records:', error);
    process.exit(1);
  });
}

export default generateExecutionRecords;
