/**
 * generate-execution-history.ts
 *
 * Generates a complete execution history record for a given execution ID,
 * mirroring the shape returned by `GET /api/executions/:id`.
 *
 * Usage:
 *   npx ts-node scripts/generate-execution-history.ts <executionId>
 *
 * If no ID is provided, defaults to the second execution (chronological).
 */

import { Store } from '../hq/backend/src/store';

interface ExecutionHistoryRecord {
  execution: Record<string, unknown>;
  task: Record<string, unknown> | null;
  summary: {
    executionId: string;
    taskId: string;
    status: string;
    executor: string;
    startedAt: string;
    completedAt: string;
    durationMs: number | null;
    taskTitle: string;
    taskType: string;
    agentId: string | undefined;
    agentName: string | undefined;
    workflowPlanId: string | undefined;
    workflowMode: string | undefined;
    steps: Array<{
      id: string;
      title: string;
      agentId: string;
      role: string;
      status: string;
    }>;
    outputSummary: string | undefined;
    errorMessage: string | undefined;
    degraded: boolean | undefined;
    retryCount: number | undefined;
    tokensUsed: number | undefined;
  };
  _meta: {
    generatedAt: string;
    stage: string;
  };
}

async function resolveSecondExecutionId(store: Store): Promise<string> {
  const executions = await store.getExecutions();
  const sorted = executions
    .slice()
    .sort((a, b) => Date.parse(a.startedAt ?? '') - Date.parse(b.startedAt ?? ''));
  if (sorted.length < 2) {
    throw new Error(`Need at least 2 executions to resolve second; found ${sorted.length}`);
  }
  return sorted[1].id;
}

async function generate(executionId: string): Promise<void> {
  const store = new Store();

  // 1. Fetch execution
  const execution = await store.getExecutionById(executionId);
  if (!execution) {
    console.error(`Execution not found: ${executionId}`);
    process.exit(1);
  }

  // 2. Fetch related task
  const task = await store.getTaskById(execution.taskId);

  // 3. Compute duration
  const startMs = execution.startedAt ? Date.parse(execution.startedAt) : null;
  const endMs = execution.completedAt || execution.endedAt
    ? Date.parse(execution.completedAt || execution.endedAt!)
    : null;
  const durationMs = startMs && endMs ? endMs - startMs : null;

  // 4. Extract step summary from workflow plan
  const steps = (execution.workflowPlan?.steps ?? []).map((step) => ({
    id: step.id,
    title: step.title,
    agentId: step.agentId,
    role: step.assignmentRole,
    status: step.status,
  }));

  // 5. Extract tokensUsed from cost logs or output snapshot
  const costLogs = await store.getCostLogsByExecutionId(executionId);
  const tokensUsed = costLogs.length > 0
    ? ((costLogs[costLogs.length - 1] as unknown as Record<string, unknown>).tokensUsed as number | undefined)
    : typeof (execution.outputSnapshot as unknown as Record<string, unknown> | null)?.tokensUsed === 'number'
      ? ((execution.outputSnapshot as unknown as Record<string, unknown>).tokensUsed as number)
      : undefined;

  // 6. Build history record
  const record: ExecutionHistoryRecord = {
    execution: { ...execution },
    task: (task ?? null) as Record<string, unknown> | null,
    summary: {
      executionId: execution.id,
      taskId: execution.taskId,
      status: execution.status,
      executor: execution.executor ?? 'unknown',
      startedAt: execution.startedAt ?? 'unknown',
      completedAt: execution.completedAt ?? execution.endedAt ?? 'unknown',
      durationMs,
      taskTitle: task?.title ?? 'unknown',
      taskType: task?.taskType ?? 'unknown',
      agentId: execution.assignments?.[0]?.agentId,
      agentName: execution.assignments?.[0]?.agentName,
      workflowPlanId: execution.workflowPlan?.id,
      workflowMode: execution.workflowPlan?.mode,
      steps,
      outputSummary: execution.outputSummary,
      errorMessage: execution.errorMessage,
      degraded: execution.degraded,
      retryCount: execution.retryCount,
      tokensUsed,
    },
    _meta: {
      generatedAt: new Date().toISOString(),
      stage: 'production',
    },
  };

  // 7. Output
  const output = process.argv.includes('--json')
    ? JSON.stringify(record, null, 2)
    : formatHuman(record);

  console.log(output);
}

function formatHuman(record: ExecutionHistoryRecord): string {
  const { summary } = record;
  const dur = summary.durationMs != null
    ? `${(summary.durationMs / 1000).toFixed(2)}s`
    : 'n/a';

  const lines = [
    '┌──────────────────────────────────────────────────────────────',
    `│  EXECUTION HISTORY  ·  ${summary.executionId}`,
    '├──────────────────────────────────────────────────────────────',
    `│  Task      ${summary.taskTitle}`,
    `│  ID        ${summary.taskId}`,
    `│  Type      ${summary.taskType}`,
    `│  Status    ${summary.status}`,
    `│  Executor  ${summary.executor}`,
    `│  Degraded  ${summary.degraded ?? false}`,
    `│  Retries   ${summary.retryCount ?? 0} / ${record.execution.maxRetries ?? '?'}`,
    `│  Started   ${summary.startedAt}`,
    `│  Completed ${summary.completedAt}`,
    `│  Duration  ${dur}`,
    `│  Tokens    ${summary.tokensUsed ?? 'n/a'}`,
    '├──────────────────────────────────────────────────────────────',
    `│  Agent     ${summary.agentName ?? 'n/a'} (${summary.agentId ?? 'n/a'})`,
    `│  Workflow  ${summary.workflowPlanId ?? 'n/a'} [${summary.workflowMode ?? '?'}]`,
    '│  Steps',
    ...summary.steps.map(
      (s) => `│    · ${s.title}  [${s.role}]  ${s.status}`
    ),
    '├──────────────────────────────────────────────────────────────',
    `│  Output    ${summary.outputSummary ?? 'n/a'}`,
    `│  Error     ${summary.errorMessage ?? 'none'}`,
    '├──────────────────────────────────────────────────────────────',
    `│  Generated ${record._meta.generatedAt}`,
    `│  Stage     ${record._meta.stage}`,
    '└──────────────────────────────────────────────────────────────',
  ];

  return lines.join('\n');
}

const execIdArg = process.argv[2];

async function main(): Promise<void> {
  const execId = execIdArg ?? (await resolveSecondExecutionId(new Store()));
  await generate(execId);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
