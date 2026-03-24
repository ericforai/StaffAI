import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Scanner } from '../scanner';
import { Store } from '../store';
import { SkillScanner } from '../skill-scanner';
import { WebServer } from '../server';

let webServer: WebServer;
let baseUrl = '';
let tempDir = '';
const originalTasksFile = process.env.AGENCY_TASKS_FILE;
const originalApprovalsFile = process.env.AGENCY_APPROVALS_FILE;
const originalExecutionsFile = process.env.AGENCY_EXECUTIONS_FILE;
const originalMemoryDir = process.env.AGENCY_MEMORY_DIR;

function getTasksFilePath() {
  return process.env.AGENCY_TASKS_FILE as string;
}

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-server-api-'));
  process.env.AGENCY_TASKS_FILE = path.join(tempDir, 'tasks.json');
  process.env.AGENCY_APPROVALS_FILE = path.join(tempDir, 'approvals.json');
  process.env.AGENCY_EXECUTIONS_FILE = path.join(tempDir, 'executions.json');
  process.env.AGENCY_MEMORY_DIR = path.join(tempDir, '.ai');

  const scanner = new Scanner();
  await scanner.scan();
  const store = new Store();
  const skillScanner = new SkillScanner();
  await skillScanner.scan();

  webServer = new WebServer(scanner, store, skillScanner, {
    runAdvancedDiscussion: async (topic) => ({
      summary: `Synthetic discussion summary for: ${topic}`,
    }),
  });
  const port = await webServer.listen(0);
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  fs.rmSync(getTasksFilePath(), { force: true });
  fs.rmSync(process.env.AGENCY_APPROVALS_FILE as string, { force: true });
  fs.rmSync(process.env.AGENCY_EXECUTIONS_FILE as string, { force: true });
  fs.rmSync(process.env.AGENCY_MEMORY_DIR as string, { recursive: true, force: true });
});

after(async () => {
  if (webServer) {
    await webServer.stop();
  }

  fs.rmSync(tempDir, { recursive: true, force: true });

  if (originalTasksFile === undefined) {
    delete process.env.AGENCY_TASKS_FILE;
  } else {
    process.env.AGENCY_TASKS_FILE = originalTasksFile;
  }

  if (originalApprovalsFile === undefined) {
    delete process.env.AGENCY_APPROVALS_FILE;
  } else {
    process.env.AGENCY_APPROVALS_FILE = originalApprovalsFile;
  }

  if (originalExecutionsFile === undefined) {
    delete process.env.AGENCY_EXECUTIONS_FILE;
  } else {
    process.env.AGENCY_EXECUTIONS_FILE = originalExecutionsFile;
  }

  if (originalMemoryDir === undefined) {
    delete process.env.AGENCY_MEMORY_DIR;
  } else {
    process.env.AGENCY_MEMORY_DIR = originalMemoryDir;
  }
});

test('GET /api/tasks returns an empty task collection placeholder', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    tasks?: unknown[];
    stage?: string;
  };

  assert.deepEqual(payload.tasks, []);
  assert.equal(payload.stage, 'sprint-1-skeleton');
});

test('POST /api/tasks creates a task and GET /api/tasks returns it', async () => {
  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Refactor server composition',
      description: 'Split route registration from domain logic',
    }),
  });

  assert.equal(createResponse.status, 201);
  const createdPayload = (await createResponse.json()) as {
    task?: {
      id?: string;
      title?: string;
      description?: string;
      status?: string;
      executionMode?: string;
      approvalRequired?: boolean;
      recommendedAgentRole?: string;
      routingStatus?: string;
    };
  };

  assert.equal(createdPayload.task?.title, 'Refactor server composition');
  assert.equal(createdPayload.task?.description, 'Split route registration from domain logic');
  assert.equal(createdPayload.task?.status, 'created');
  assert.equal(createdPayload.task?.executionMode, 'single');
  assert.equal(createdPayload.task?.approvalRequired, false);
  assert.equal(createdPayload.task?.recommendedAgentRole, 'software-architect');
  assert.equal(createdPayload.task?.routingStatus, 'matched');
  assert.equal(typeof createdPayload.task?.id, 'string');

  const listResponse = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(listResponse.status, 200);
  const listPayload = (await listResponse.json()) as {
    tasks?: Array<{ id: string; title: string; status: string }>;
  };

  assert.equal(listPayload.tasks?.length, 1);
  assert.equal(listPayload.tasks?.[0]?.id, createdPayload.task?.id);
  assert.equal(listPayload.tasks?.[0]?.title, 'Refactor server composition');
  assert.equal(listPayload.tasks?.[0]?.status, 'created');

  const detailResponse = await fetch(`${baseUrl}/api/tasks/${createdPayload.task?.id}`);
  assert.equal(detailResponse.status, 200);
  const detailPayload = (await detailResponse.json()) as {
    task?: {
      id?: string;
      recommendedAgentRole?: string;
      routingStatus?: string;
    };
    approvals?: Array<{ status: string }>;
    executions?: Array<{ status: string; outputSummary?: string }>;
    stage?: string;
  };

  assert.equal(detailPayload.task?.id, createdPayload.task?.id);
  assert.equal(detailPayload.task?.recommendedAgentRole, 'software-architect');
  assert.equal(detailPayload.task?.routingStatus, 'matched');
  assert.deepEqual(detailPayload.approvals, []);
  assert.deepEqual(detailPayload.executions, []);
  assert.equal(detailPayload.stage, 'sprint-1-skeleton');
});

test('GET /api/tasks returns newest tasks first', async () => {
  const firstResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Older task',
      description: 'Created first',
    }),
  });
  assert.equal(firstResponse.status, 201);

  const secondResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Newer task',
      description: 'Created second',
    }),
  });
  assert.equal(secondResponse.status, 201);

  const listResponse = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(listResponse.status, 200);
  const listPayload = (await listResponse.json()) as {
    tasks?: Array<{ title: string }>;
  };

  assert.equal(listPayload.tasks?.[0]?.title, 'Newer task');
  assert.equal(listPayload.tasks?.[1]?.title, 'Older task');
});

test('POST /api/tasks rejects invalid payloads', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '',
      description: 'Missing title should fail',
    }),
  });

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { error?: string };
  assert.equal(payload.error, 'title and description are required');
});

test('GET /api/tasks/:id returns not found for unknown tasks', async () => {
  const response = await fetch(`${baseUrl}/api/tasks/missing-task`);
  assert.equal(response.status, 404);
  const payload = (await response.json()) as {
    error?: string;
    taskId?: string;
    stage?: string;
  };

  assert.equal(payload.error, 'task not found');
  assert.equal(payload.taskId, 'missing-task');
  assert.equal(payload.stage, 'sprint-1-skeleton');
});

test('POST /api/tasks accepts advanced discussion as an execution mode', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Run a multi-expert architecture review',
      description: 'Use discussion mode to gather synthesis from multiple experts',
      executionMode: 'advanced_discussion',
    }),
  });

  assert.equal(response.status, 201);
  const payload = (await response.json()) as {
    task?: { executionMode?: string };
  };

  assert.equal(payload.task?.executionMode, 'advanced_discussion');
});

test('advanced discussion execution completes through the discussion runner', async () => {
  const taskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Run a multi-expert architecture review',
      description: 'Use discussion mode to gather synthesis from multiple experts',
      executionMode: 'advanced_discussion',
    }),
  });
  assert.equal(taskResponse.status, 201);
  const taskPayload = (await taskResponse.json()) as {
    task?: { id?: string; status?: string };
  };
  const taskId = taskPayload.task?.id;
  assert.equal(typeof taskId, 'string');

  const executeResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'codex',
      topic: 'Need a synthesized architecture review',
    }),
  });

  assert.equal(executeResponse.status, 201);
  const executePayload = (await executeResponse.json()) as {
    mode?: string;
    execution?: { status?: string; outputSummary?: string };
    task?: { status?: string };
  };

  assert.equal(executePayload.mode, 'advanced_discussion');
  assert.equal(executePayload.execution?.status, 'completed');
  assert.equal(typeof executePayload.execution?.outputSummary, 'string');
  assert.equal(executePayload.task?.status, 'completed');
});

test('POST /api/tasks/:id/execute creates an execution and updates task state', async () => {
  const memoryRootDir = process.env.AGENCY_MEMORY_DIR as string;
  fs.mkdirSync(memoryRootDir, { recursive: true });
  fs.writeFileSync(
    path.join(memoryRootDir, 'execution-context.md'),
    '# Context\nsingle task lightweight execution workspace context\n',
    'utf8'
  );

  const taskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Execute a single task',
      description: 'Run a non-risky task through the lightweight execution service',
    }),
  });
  assert.equal(taskResponse.status, 201);
  const taskPayload = (await taskResponse.json()) as {
    task?: { id?: string; status?: string };
  };
  const taskId = taskPayload.task?.id;
  assert.equal(typeof taskId, 'string');

  const executeResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'codex',
      summary: 'Execution finished cleanly',
    }),
  });

  assert.equal(executeResponse.status, 201);
  const executePayload = (await executeResponse.json()) as {
    execution?: { id?: string; status?: string; taskId?: string; outputSummary?: string };
    task?: { status?: string };
  };

  assert.equal(executePayload.execution?.taskId, taskId);
  assert.equal(executePayload.execution?.status, 'completed');
  assert.equal(executePayload.execution?.outputSummary, 'Execution finished cleanly');
  assert.equal(executePayload.task?.status, 'completed');

  const executionDetailResponse = await fetch(`${baseUrl}/api/executions/${executePayload.execution?.id}`);
  assert.equal(executionDetailResponse.status, 200);
  const executionDetailPayload = (await executionDetailResponse.json()) as {
    execution?: { id?: string; status?: string; outputSummary?: string; memoryContextExcerpt?: string };
    stage?: string;
  };

  assert.equal(executionDetailPayload.execution?.id, executePayload.execution?.id);
  assert.equal(executionDetailPayload.execution?.status, 'completed');
  assert.equal(executionDetailPayload.execution?.outputSummary, 'Execution finished cleanly');
  assert.equal(typeof executionDetailPayload.execution?.memoryContextExcerpt, 'string');
  assert.equal(executionDetailPayload.stage, 'production');

  const taskDetailResponse = await fetch(`${baseUrl}/api/tasks/${taskId}`);
  assert.equal(taskDetailResponse.status, 200);
  const taskDetailPayload = (await taskDetailResponse.json()) as {
    executions?: Array<{ id?: string; status?: string; outputSummary?: string }>;
  };

  assert.equal(taskDetailPayload.executions?.length, 1);
  assert.equal(taskDetailPayload.executions?.[0]?.id, executePayload.execution?.id);
  assert.equal(taskDetailPayload.executions?.[0]?.status, 'completed');
  assert.equal(taskDetailPayload.executions?.[0]?.outputSummary, 'Execution finished cleanly');
});

test('GET /api/task-events returns emitted task and execution events', async () => {
  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Emit task events',
      description: 'Verify task event feed endpoint',
    }),
  });
  assert.equal(createResponse.status, 201);
  const createdPayload = (await createResponse.json()) as { task?: { id?: string } };
  const taskId = createdPayload.task?.id;

  const executeResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'codex',
      summary: 'event emission done',
    }),
  });
  assert.equal(executeResponse.status, 201);

  const eventsResponse = await fetch(`${baseUrl}/api/task-events`);
  assert.equal(eventsResponse.status, 200);
  const eventsPayload = (await eventsResponse.json()) as {
    events?: Array<{ taskEventType?: string; taskId?: string; timestamp?: string }>;
  };
  assert.equal(Array.isArray(eventsPayload.events), true);
  assert.equal(eventsPayload.events?.some((event) => event.taskEventType === 'task_created' && event.taskId === taskId), true);
  assert.equal(
    eventsPayload.events?.some((event) => event.taskEventType === 'execution_completed' && event.taskId === taskId),
    true
  );
  assert.equal(typeof eventsPayload.events?.[0]?.timestamp, 'string');
});

test('task execution writes summary into memory directory', async () => {
  const taskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Document execution memory',
      description: 'Ensure execution summary gets persisted into .ai memory log',
    }),
  });
  assert.equal(taskResponse.status, 201);
  const taskPayload = (await taskResponse.json()) as { task?: { id?: string } };
  const taskId = taskPayload.task?.id;
  assert.equal(typeof taskId, 'string');

  const executeResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'codex',
      summary: 'Memory summary check',
    }),
  });
  assert.equal(executeResponse.status, 201);

  const memoryFile = path.join(process.env.AGENCY_MEMORY_DIR as string, 'task-summaries', `${new Date().toISOString().slice(0, 10)}-${taskId}.md`);
  assert.equal(fs.existsSync(memoryFile), true);
  const content = fs.readFileSync(memoryFile, 'utf8');
  assert.match(content, /Memory summary check/);
});

test('tasks waiting for approval cannot be executed', async () => {
  const taskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Delete core configuration',
      description: 'This destructive change will delete production configuration and must be approved',
    }),
  });
  assert.equal(taskResponse.status, 201);
  const taskPayload = (await taskResponse.json()) as { task?: { id?: string } };

  const executeResponse = await fetch(`${baseUrl}/api/tasks/${taskPayload.task?.id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'codex',
    }),
  });

  assert.equal(executeResponse.status, 409);
  const executePayload = (await executeResponse.json()) as { error?: string };
  assert.equal(executePayload.error, 'task is not executable in its current state');
});

test('GET /api/approvals returns an empty approval collection placeholder', async () => {
  const response = await fetch(`${baseUrl}/api/approvals`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    approvals?: unknown[];
    stage?: string;
  };

  assert.deepEqual(payload.approvals, []);
  assert.equal(payload.stage, 'sprint-1-skeleton');
});

test('high-risk task creation generates an approval record', async () => {
  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Delete core configuration',
      description: 'This destructive change will delete production configuration and must be approved',
    }),
  });

  assert.equal(createResponse.status, 201);
  const createdPayload = (await createResponse.json()) as {
    task?: {
      id?: string;
      approvalRequired?: boolean;
      riskLevel?: string;
      status?: string;
    };
  };

  assert.equal(createdPayload.task?.approvalRequired, true);
  assert.equal(createdPayload.task?.riskLevel, 'high');
  assert.equal(createdPayload.task?.status, 'waiting_approval');

  const approvalsResponse = await fetch(`${baseUrl}/api/approvals`);
  assert.equal(approvalsResponse.status, 200);
  const approvalsPayload = (await approvalsResponse.json()) as {
    approvals?: Array<{
      id: string;
      taskId: string;
      status: string;
      requestedBy: string;
    }>;
  };

  assert.equal(approvalsPayload.approvals?.length, 1);
  assert.equal(approvalsPayload.approvals?.[0]?.taskId, createdPayload.task?.id);
  assert.equal(approvalsPayload.approvals?.[0]?.status, 'pending');
  assert.equal(approvalsPayload.approvals?.[0]?.requestedBy, 'system');

  const taskDetailResponse = await fetch(`${baseUrl}/api/tasks/${createdPayload.task?.id}`);
  assert.equal(taskDetailResponse.status, 200);
  const taskDetailPayload = (await taskDetailResponse.json()) as {
    approvals?: Array<{ status?: string; taskId?: string }>;
  };

  assert.equal(taskDetailPayload.approvals?.length, 1);
  assert.equal(taskDetailPayload.approvals?.[0]?.taskId, createdPayload.task?.id);
  assert.equal(taskDetailPayload.approvals?.[0]?.status, 'pending');
});

test('approvals can be approved and rejected', async () => {
  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Delete protected data',
      description: 'A risky delete action should create an approval record',
    }),
  });
  assert.equal(createResponse.status, 201);

  const approvalsResponse = await fetch(`${baseUrl}/api/approvals`);
  const approvalsPayload = (await approvalsResponse.json()) as {
    approvals?: Array<{ id: string; status: string }>;
  };
  const approvalId = approvalsPayload.approvals?.[0]?.id;
  assert.equal(typeof approvalId, 'string');

  const approveResponse = await fetch(`${baseUrl}/api/approvals/${approvalId}/approve`, {
    method: 'POST',
  });
  assert.equal(approveResponse.status, 200);
  const approvedPayload = (await approveResponse.json()) as {
    approval?: { status?: string; taskId?: string };
    task?: { status?: string; approvalRequired?: boolean };
  };
  assert.equal(approvedPayload.approval?.status, 'approved');
  assert.equal(approvedPayload.task?.status, 'created');
  assert.equal(approvedPayload.task?.approvalRequired, false);

  const createSecondResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Delete user access',
      description: 'Another risky delete action should create another approval record',
    }),
  });
  assert.equal(createSecondResponse.status, 201);

  const secondApprovalsResponse = await fetch(`${baseUrl}/api/approvals`);
  const secondApprovalsPayload = (await secondApprovalsResponse.json()) as {
    approvals?: Array<{ id: string; status: string }>;
  };
  const pendingApproval = secondApprovalsPayload.approvals?.find((approval) => approval.status === 'pending');
  assert.equal(typeof pendingApproval?.id, 'string');

  const rejectResponse = await fetch(`${baseUrl}/api/approvals/${pendingApproval?.id}/reject`, {
    method: 'POST',
  });
  assert.equal(rejectResponse.status, 200);
  const rejectedPayload = (await rejectResponse.json()) as {
    approval?: { status?: string };
    task?: { status?: string; approvalRequired?: boolean };
  };
  assert.equal(rejectedPayload.approval?.status, 'rejected');
  assert.equal(rejectedPayload.task?.status, 'cancelled');
  assert.equal(rejectedPayload.task?.approvalRequired, true);
});

test('GET /api/executions/:id returns not found for unknown executions', async () => {
  const response = await fetch(`${baseUrl}/api/executions/missing-execution`);
  assert.equal(response.status, 404);
  const payload = (await response.json()) as {
    error?: string;
    executionId?: string;
    stage?: string;
  };

  assert.equal(payload.error, 'execution not found');
  assert.equal(payload.executionId, 'missing-execution');
  assert.equal(payload.stage, 'production');
});

test('GET /api/executions returns execution history with query filters and summary metadata', async () => {
  const firstTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Execution history task A',
      description: 'Generate execution records for history endpoint',
    }),
  });
  assert.equal(firstTaskResponse.status, 201);
  const firstTaskPayload = (await firstTaskResponse.json()) as { task?: { id?: string } };
  const firstTaskId = firstTaskPayload.task?.id;

  const secondTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Execution history task B',
      description: 'Generate execution records for history endpoint',
    }),
  });
  assert.equal(secondTaskResponse.status, 201);
  const secondTaskPayload = (await secondTaskResponse.json()) as { task?: { id?: string } };
  const secondTaskId = secondTaskPayload.task?.id;

  const firstExecutionResponse = await fetch(`${baseUrl}/api/tasks/${firstTaskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'codex',
      summary: 'first execution',
    }),
  });
  assert.equal(firstExecutionResponse.status, 201);
  const firstExecutionPayload = (await firstExecutionResponse.json()) as { execution?: { id?: string } };

  const secondExecutionResponse = await fetch(`${baseUrl}/api/tasks/${secondTaskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'claude',
      summary: 'second execution',
    }),
  });
  assert.equal(secondExecutionResponse.status, 201);
  const secondExecutionPayload = (await secondExecutionResponse.json()) as { execution?: { id?: string } };

  const listResponse = await fetch(`${baseUrl}/api/executions`);
  assert.equal(listResponse.status, 200);
  const listPayload = (await listResponse.json()) as {
    executions?: Array<{ id?: string; taskId?: string; status?: string; executor?: string }>;
    summary?: {
      total?: number;
      matched?: number;
      returned?: number;
      statusCounts?: Record<string, number>;
      executorCounts?: Record<string, number>;
      appliedFilters?: {
        taskId?: string;
        status?: string;
        executor?: string;
        limit?: number;
      };
    };
    stage?: string;
  };
  assert.equal(listPayload.stage, 'production');
  assert.equal(listPayload.executions?.some((execution) => execution.id === firstExecutionPayload.execution?.id), true);
  assert.equal(listPayload.executions?.some((execution) => execution.id === secondExecutionPayload.execution?.id), true);
  assert.equal(listPayload.summary?.total, 2);
  assert.equal(listPayload.summary?.matched, 2);
  assert.equal(listPayload.summary?.returned, 2);
  assert.equal(listPayload.summary?.statusCounts?.completed, 2);
  assert.equal(listPayload.summary?.executorCounts?.codex, 1);
  assert.equal(listPayload.summary?.executorCounts?.claude, 1);
  assert.equal(listPayload.summary?.appliedFilters?.taskId, undefined);
  assert.equal(listPayload.summary?.appliedFilters?.status, undefined);
  assert.equal(listPayload.summary?.appliedFilters?.executor, undefined);
  assert.equal(listPayload.summary?.appliedFilters?.limit, undefined);

  const taskFilteredResponse = await fetch(`${baseUrl}/api/executions?taskId=${firstTaskId}`);
  assert.equal(taskFilteredResponse.status, 200);
  const taskFilteredPayload = (await taskFilteredResponse.json()) as {
    executions?: Array<{ taskId?: string }>;
    summary?: {
      matched?: number;
      returned?: number;
      appliedFilters?: { taskId?: string };
    };
  };
  assert.equal(taskFilteredPayload.executions?.every((execution) => execution.taskId === firstTaskId), true);
  assert.equal(taskFilteredPayload.summary?.matched, 1);
  assert.equal(taskFilteredPayload.summary?.returned, 1);
  assert.equal(taskFilteredPayload.summary?.appliedFilters?.taskId, firstTaskId);

  const executorFilteredResponse = await fetch(`${baseUrl}/api/executions?executor=claude`);
  assert.equal(executorFilteredResponse.status, 200);
  const executorFilteredPayload = (await executorFilteredResponse.json()) as {
    executions?: Array<{ executor?: string }>;
    summary?: {
      matched?: number;
      returned?: number;
      appliedFilters?: { executor?: string };
    };
  };
  assert.equal(executorFilteredPayload.executions?.every((execution) => execution.executor === 'claude'), true);
  assert.equal(executorFilteredPayload.summary?.matched, 1);
  assert.equal(executorFilteredPayload.summary?.returned, 1);
  assert.equal(executorFilteredPayload.summary?.appliedFilters?.executor, 'claude');

  const statusExecutorLimitedResponse = await fetch(
    `${baseUrl}/api/executions?status=completed&executor=codex&limit=1`
  );
  assert.equal(statusExecutorLimitedResponse.status, 200);
  const statusExecutorLimitedPayload = (await statusExecutorLimitedResponse.json()) as {
    executions?: Array<{ status?: string; executor?: string }>;
    summary?: {
      total?: number;
      matched?: number;
      returned?: number;
      appliedFilters?: { status?: string; executor?: string; limit?: number };
    };
  };
  assert.equal(statusExecutorLimitedPayload.executions?.every((execution) => execution.status === 'completed'), true);
  assert.equal(statusExecutorLimitedPayload.executions?.every((execution) => execution.executor === 'codex'), true);
  assert.equal(statusExecutorLimitedPayload.executions?.length, 1);
  assert.equal(statusExecutorLimitedPayload.summary?.total, 2);
  assert.equal(statusExecutorLimitedPayload.summary?.matched, 1);
  assert.equal(statusExecutorLimitedPayload.summary?.returned, 1);
  assert.equal(statusExecutorLimitedPayload.summary?.appliedFilters?.status, 'completed');
  assert.equal(statusExecutorLimitedPayload.summary?.appliedFilters?.executor, 'codex');
  assert.equal(statusExecutorLimitedPayload.summary?.appliedFilters?.limit, 1);

  const failedStatusResponse = await fetch(`${baseUrl}/api/executions?status=failed`);
  assert.equal(failedStatusResponse.status, 200);
  const failedStatusPayload = (await failedStatusResponse.json()) as {
    executions?: Array<{ status?: string }>;
    summary?: {
      matched?: number;
      returned?: number;
      appliedFilters?: { status?: string };
    };
  };
  assert.equal(failedStatusPayload.executions?.length, 0);
  assert.equal(failedStatusPayload.summary?.matched, 0);
  assert.equal(failedStatusPayload.summary?.returned, 0);
  assert.equal(failedStatusPayload.summary?.appliedFilters?.status, 'failed');
});

test('GET /api/executions supports field projections without breaking default payloads', async () => {
  const taskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Execution projection task',
      description: 'Generate execution records for projection checks',
    }),
  });
  assert.equal(taskResponse.status, 201);
  const taskPayload = (await taskResponse.json()) as { task?: { id?: string } };
  const taskId = taskPayload.task?.id;

  const executeResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'openai',
      summary: 'projection summary',
    }),
  });
  assert.equal(executeResponse.status, 201);

  const projectedResponse = await fetch(`${baseUrl}/api/executions?taskId=${taskId}&fields=id,taskId,status,executor`);
  assert.equal(projectedResponse.status, 200);
  const projectedPayload = (await projectedResponse.json()) as {
    executions?: Array<Record<string, unknown>>;
    summary?: {
      projectedFields?: string[];
      matched?: number;
      returned?: number;
    };
  };
  const projectedKeys = Object.keys(projectedPayload.executions?.[0] ?? {}).sort();
  assert.deepEqual(projectedKeys, ['executor', 'id', 'status', 'taskId']);
  assert.deepEqual(projectedPayload.summary?.projectedFields, ['id', 'taskId', 'status', 'executor']);
  assert.equal(projectedPayload.summary?.matched, 1);
  assert.equal(projectedPayload.summary?.returned, 1);

  const defaultResponse = await fetch(`${baseUrl}/api/executions?taskId=${taskId}`);
  assert.equal(defaultResponse.status, 200);
  const defaultPayload = (await defaultResponse.json()) as {
    executions?: Array<Record<string, unknown>>;
  };
  const defaultKeys = Object.keys(defaultPayload.executions?.[0] ?? {});
  assert.equal(defaultKeys.includes('outputSummary'), true);
  assert.equal(defaultKeys.includes('startedAt'), true);
});
