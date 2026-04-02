import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApprovalRecord, ToolCallLog } from '../shared/task-types';
import { ToolGateway } from '../tools/tool-gateway';
import { resolveToolApprovalClaim } from '../api/tools';

function makeGateway(): ToolGateway {
  return new ToolGateway({
    async saveToolCallLog(_log: ToolCallLog) {
      /* noop */
    },
    async saveApproval(_approval: any) {
      /* noop */
    },
  });
}

function approvedRecord(taskId: string): ApprovalRecord {
  return {
    id: 'approval-1',
    taskId,
    status: 'approved',
    requestedBy: 'tester',
    requestedAt: new Date().toISOString(),
  };
}

test('resolveToolApprovalClaim passes through non-high-risk tools unchanged', async () => {
  const gateway = makeGateway();
  const store = {
    async getApprovalsByTaskId(): Promise<ApprovalRecord[]> {
      throw new Error('should not load approvals for medium-risk tool');
    },
  };
  const ok = await resolveToolApprovalClaim(store, gateway, 'test_runner', 'task-1', true);
  assert.equal(ok, true);
});

test('resolveToolApprovalClaim requires approved ApprovalRecord for high-risk tools', async () => {
  const gateway = makeGateway();
  const storeEmpty = {
    async getApprovalsByTaskId(): Promise<ApprovalRecord[]> {
      return [];
    },
  };
  const denied = await resolveToolApprovalClaim(storeEmpty, gateway, 'runtime_executor', 'task-1', true);
  assert.equal(denied, false);

  const storeOk = {
    async getApprovalsByTaskId(tid: string): Promise<ApprovalRecord[]> {
      assert.equal(tid, 'task-1');
      return [approvedRecord(tid)];
    },
  };
  const allowed = await resolveToolApprovalClaim(storeOk, gateway, 'runtime_executor', 'task-1', true);
  assert.equal(allowed, true);
});

test('resolveToolApprovalClaim rejects high-risk claim without taskId', async () => {
  const gateway = makeGateway();
  const store = {
    async getApprovalsByTaskId(): Promise<ApprovalRecord[]> {
      return [approvedRecord('task-1')];
    },
  };
  const denied = await resolveToolApprovalClaim(store, gateway, 'runtime_executor', undefined, true);
  assert.equal(denied, false);
});
