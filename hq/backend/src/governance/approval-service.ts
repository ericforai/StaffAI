import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { ApprovalRecord } from '../shared/task-types';

export interface ApprovalDecision {
  riskLevel: 'low' | 'high';
  approvalRequired: boolean;
}

export interface ApprovalInput {
  title: string;
  description: string;
}

export function evaluateApprovalRequirement(input: ApprovalInput): ApprovalDecision {
  const haystack = `${input.title} ${input.description}`.toLowerCase();
  const requiresApproval =
    haystack.includes('delete') ||
    haystack.includes('destructive') ||
    haystack.includes('production') ||
    haystack.includes('critical');

  return {
    riskLevel: requiresApproval ? 'high' : 'low',
    approvalRequired: requiresApproval,
  };
}

export function createApprovalRecord(taskId: string, store: Pick<Store, 'saveApproval'>): ApprovalRecord {
  const approval: ApprovalRecord = {
    id: randomUUID(),
    taskId,
    status: 'pending',
    requestedBy: 'system',
    requestedAt: new Date().toISOString(),
  };

  store.saveApproval(approval);
  return approval;
}

export function approveApproval(approvalId: string, store: Pick<Store, 'updateApprovalStatus'>) {
  return store.updateApprovalStatus(approvalId, 'approved');
}

export function rejectApproval(approvalId: string, store: Pick<Store, 'updateApprovalStatus'>) {
  return store.updateApprovalStatus(approvalId, 'rejected');
}
