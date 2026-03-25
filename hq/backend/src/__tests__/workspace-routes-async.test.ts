import test from 'node:test';
import assert from 'node:assert/strict';
import type express from 'express';
import type { Store } from '../store';
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from '../shared/task-types';
import { registerApprovalRoutes } from '../api/approvals';
import { registerExecutionRoutes } from '../api/executions';
import { registerTaskRoutes } from '../api/tasks';

type RouteHandler = (req: { params?: Record<string, string>; query?: Record<string, unknown> }, res: MockResponse) => Promise<void> | void;

class MockResponse {
  public statusCode = 200;
  public payload: unknown;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown) {
    this.payload = payload;
    return this;
  }
}

function createMockApp() {
  const handlers = new Map<string, RouteHandler>();
  return {
    handlers,
    get(path: string, handler: RouteHandler) {
      handlers.set(`GET ${path}`, handler);
      return this;
    },
    post(path: string, handler: RouteHandler) {
      handlers.set(`POST ${path}`, handler);
      return this;
    },
  } as unknown as express.Application & { handlers: Map<string, RouteHandler> };
}

function makeTask(id: string, createdAt: string): TaskRecord {
  return {
    id,
    title: id,
    description: 'description',
    taskType: 'general',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: createdAt,
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect'],
    routeReason: 'matched by default',
    routingStatus: 'matched',
    createdAt,
    updatedAt: createdAt,
  };
}

function makeStore() {
  const tasks = [makeTask('task-older', '2026-03-24T00:00:00.000Z'), makeTask('task-newer', '2026-03-24T01:00:00.000Z')];
  const approvals: ApprovalRecord[] = [
    {
      id: 'approval-1',
      taskId: 'task-newer',
      status: 'pending',
      requestedBy: 'system',
      requestedAt: '2026-03-24T01:00:00.000Z',
    },
  ];
  const executions: ExecutionRecord[] = [
    {
      id: 'execution-1',
      taskId: 'task-newer',
      status: 'completed',
      executor: 'codex',
      outputSummary: 'done',
    },
  ];

  return {
    async getTasks() {
      return [...tasks];
    },
    async getTaskById(taskId: string) {
      return tasks.find((task) => task.id === taskId) || null;
    },
    async getApprovalsByTaskId(taskId: string) {
      return approvals.filter((approval) => approval.taskId === taskId);
    },
    async getExecutionsByTaskId(taskId: string) {
      return executions.filter((execution) => execution.taskId === taskId);
    },
    async getApprovals() {
      return [...approvals];
    },
    async getExecutions() {
      return [...executions];
    },
    async getExecutionById(executionId: string) {
      return executions.find((execution) => execution.id === executionId) || null;
    },
  } as unknown as Store;
}

async function invoke(
  handlers: Map<string, RouteHandler>,
  method: 'GET' | 'POST',
  path: string,
  req: { params?: Record<string, string>; query?: Record<string, unknown> } = {}
) {
  const handler = handlers.get(`${method} ${path}`);
  assert.ok(handler, `missing handler for ${method} ${path}`);
  const res = new MockResponse();
  await handler({ params: {}, query: {}, ...req }, res);
  return res;
}

test('workspace read routes await async store methods', async () => {
  const app = createMockApp();
  const store = makeStore();

  registerTaskRoutes(app, store);
  registerApprovalRoutes(app, store);
  registerExecutionRoutes(app, store);

  const tasksList = await invoke(app.handlers, 'GET', '/api/tasks');
  assert.equal(tasksList.statusCode, 200);
  const tasksListPayload = tasksList.payload as {
    tasks?: TaskRecord[];
    summary?: { totalTasks?: number; statusCounts?: { routed?: number } };
  };
  assert.equal(tasksListPayload.tasks?.[0]?.id, 'task-newer');
  assert.equal(tasksListPayload.summary?.totalTasks, 2);
  assert.equal(tasksListPayload.summary?.statusCounts?.routed, 2);

  const taskDetail = await invoke(app.handlers, 'GET', '/api/tasks/:id', { params: { id: 'task-newer' } });
  assert.equal(taskDetail.statusCode, 200);
  const taskDetailPayload = taskDetail.payload as {
    task?: TaskRecord;
    approvals?: ApprovalRecord[];
    executions?: ExecutionRecord[];
    workflowPlan?: { mode?: string };
    assignments?: Array<{ id?: string; status?: string }>;
    summary?: { approvalCounts?: { pending?: number }; executionCount?: number };
  };
  assert.equal(taskDetailPayload.task?.id, 'task-newer');
  assert.equal(taskDetailPayload.approvals?.length, 1);
  assert.equal(taskDetailPayload.executions?.length, 1);
  assert.equal(taskDetailPayload.summary?.approvalCounts?.pending, 1);
  assert.equal(taskDetailPayload.summary?.executionCount, 1);

  const approvalsList = await invoke(app.handlers, 'GET', '/api/approvals');
  assert.equal(approvalsList.statusCode, 200);
  const approvalsListPayload = approvalsList.payload as {
    approvals?: ApprovalRecord[];
    summary?: { total?: number; statusCounts?: { pending?: number } };
  };
  assert.equal(approvalsListPayload.approvals?.[0]?.id, 'approval-1');
  assert.equal(approvalsListPayload.summary?.total, 1);
  assert.equal(approvalsListPayload.summary?.statusCounts?.pending, 1);

  const executionsList = await invoke(app.handlers, 'GET', '/api/executions');
  assert.equal(executionsList.statusCode, 200);
  assert.equal((executionsList.payload as { executions?: ExecutionRecord[] }).executions?.[0]?.id, 'execution-1');

  const executionDetail = await invoke(app.handlers, 'GET', '/api/executions/:id', { params: { id: 'execution-1' } });
  assert.equal(executionDetail.statusCode, 200);
  assert.equal((executionDetail.payload as { execution?: ExecutionRecord }).execution?.id, 'execution-1');
});
