import test from 'node:test';
import assert from 'node:assert/strict';
import type express from 'express';
import type { Store } from '../store';
import type { ApprovalRecord } from '../shared/task-types';
import { registerApprovalRoutes } from '../api/approvals';
import { InvalidApprovalStateError } from '../governance/approval-service-v2';

type RouteHandler = (
  req: { params?: Record<string, string>; body?: unknown },
  res: MockResponse
) => Promise<void> | void;

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

async function invoke(
  handlers: Map<string, RouteHandler>,
  method: 'GET' | 'POST',
  path: string,
  req: { params?: Record<string, string>; body?: unknown } = {}
) {
  const handler = handlers.get(`${method} ${path}`);
  assert.ok(handler, `missing handler for ${method} ${path}`);
  const res = new MockResponse();
  await handler({ params: {}, ...req }, res);
  return res;
}

function makeStore(input?: {
  approvals?: ApprovalRecord[];
  updateTask?: (taskId: string, updater: (current: any) => any) => Promise<any>;
}) {
  const approvals = input?.approvals ?? [];
  return {
    async getApprovals() {
      return approvals;
    },
    async updateTask(taskId: string, updater: (current: any) => any) {
      if (input?.updateTask) {
        return await input.updateTask(taskId, updater);
      }
      return updater({ id: taskId });
    },
  } as unknown as Store;
}

test('POST /api/approvals/:id/cancel returns 501 when ApprovalServiceV2 is not configured', async () => {
  const app = createMockApp();
  registerApprovalRoutes(app, makeStore());

  const res = await invoke(app.handlers, 'POST', '/api/approvals/:id/cancel', {
    params: { id: 'approval-1' },
    body: { actor: 'system' },
  });

  assert.equal(res.statusCode, 501);
  assert.deepEqual(res.payload, {
    error: 'cancel approval not available - requires ApprovalServiceV2',
  });
});

test('GET /api/approvals/:id/extended returns 501 when ApprovalServiceV2 is not configured', async () => {
  const app = createMockApp();
  registerApprovalRoutes(app, makeStore());

  const res = await invoke(app.handlers, 'GET', '/api/approvals/:id/extended', {
    params: { id: 'approval-1' },
  });

  assert.equal(res.statusCode, 501);
  assert.deepEqual(res.payload, {
    error: 'extended approval details not available - requires ApprovalServiceV2',
  });
});

test('POST /api/approvals/:id/cancel maps InvalidApprovalStateError to 400', async () => {
  const app = createMockApp();

  registerApprovalRoutes(app, makeStore(), {
    approvalService: {
      async cancel() {
        throw new InvalidApprovalStateError('approval-1', 'approved', 'pending');
      },
      // Unused in this test
      async approve() {
        return null;
      },
      async reject() {
        return null;
      },
      async getExtendedApproval() {
        return null;
      },
    } as any,
  });

  const res = await invoke(app.handlers, 'POST', '/api/approvals/:id/cancel', {
    params: { id: 'approval-1' },
    body: { actor: 'manager1', reason: 'too late' },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    error: 'cannot cancel approval',
    reason: 'approval is not in pending state',
  });
});

