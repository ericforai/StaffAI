'use client';

import { useEffect, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { ApprovalSummary } from '../types';

export function useApprovalActions(initialApprovals: ApprovalSummary[]) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setApprovals(initialApprovals);
  }, [initialApprovals]);

  async function runApprovalAction(approvalId: string, action: 'approve' | 'reject') {
    try {
      setPendingId(approvalId);
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/approvals/${approvalId}/${action}`, {
        method: 'POST',
      });
      const payload = (await response.json()) as {
        approval?: ApprovalSummary;
        error?: string;
      };
      if (!response.ok || !payload.approval) {
        throw new Error(payload.error || '审批操作失败。');
      }

      setApprovals((current) =>
        current.map((approval) => (approval.id === approvalId ? { ...approval, ...payload.approval } : approval))
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '审批操作失败。');
    } finally {
      setPendingId(null);
    }
  }

  return {
    approvals,
    pendingId,
    error,
    approveApproval: (approvalId: string) => runApprovalAction(approvalId, 'approve'),
    rejectApproval: (approvalId: string) => runApprovalAction(approvalId, 'reject'),
  };
}
