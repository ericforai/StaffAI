import test from 'node:test';
import assert from 'node:assert/strict';
import type { Store } from '../store';
import type { ApprovalRecord, ApprovalStatus } from '../shared/task-types';
import {
  createApprovalRecord,
  evaluateApprovalRequirement,
  rejectApproval,
  approveApproval,
} from '../governance/approval-service';

test('evaluateApprovalRequirement flags destructive work as high risk', () => {
  const decision = evaluateApprovalRequirement({
    title: 'Delete core configuration',
    description: 'This destructive delete changes critical production configuration',
  });

  assert.equal(decision.riskLevel, 'high');
  assert.equal(decision.approvalRequired, true);
});

test('evaluateApprovalRequirement leaves normal work as low risk', () => {
  const decision = evaluateApprovalRequirement({
    title: 'Improve task list wording',
    description: 'Adjust a label in the task list UI',
  });

  assert.equal(decision.riskLevel, 'low');
  assert.equal(decision.approvalRequired, false);
});

test('createApprovalRecord persists a pending approval', () => {
  const approvals: unknown[] = [];
  const store = {
    saveApproval(approval: ApprovalRecord) {
      approvals.push(approval);
    },
  } as Pick<Store, 'saveApproval'>;

  const approval = createApprovalRecord('task-1', store);
  assert.equal(approval.taskId, 'task-1');
  assert.equal(approval.status, 'pending');
  assert.equal(approval.requestedBy, 'system');
  assert.equal(approvals.length, 1);
});

test('approveApproval updates approval status', () => {
  const store = {
    updateApprovalStatus(id: string, status: ApprovalStatus) {
      return {
        id,
        taskId: 'task-1',
        status,
        requestedBy: 'system',
        requestedAt: 'now',
        resolvedAt: 'later',
      };
    },
  } as Pick<Store, 'updateApprovalStatus'>;

  const approval = approveApproval('approval-1', store);
  assert.equal(approval?.status, 'approved');
});

test('rejectApproval updates approval status', () => {
  const store = {
    updateApprovalStatus(id: string, status: ApprovalStatus) {
      return {
        id,
        taskId: 'task-1',
        status,
        requestedBy: 'system',
        requestedAt: 'now',
        resolvedAt: 'later',
      };
    },
  } as Pick<Store, 'updateApprovalStatus'>;

  const approval = rejectApproval('approval-1', store);
  assert.equal(approval?.status, 'rejected');
});
