'use client';

import { useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { ApprovalSummary } from '../types';

/** Stable string so we only sync when server data meaningfully changed (avoids `|| []` new reference loops). */
function approvalsSyncKey(list: ApprovalSummary[]): string {
  if (list.length === 0) return '';
  return list
    .map((a) => `${a.id}\0${a.status}\0${a.resolvedAt ?? ''}`)
    .sort()
    .join('\n');
}

export function useApprovalActions(initialApprovals: ApprovalSummary[]) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevSyncKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const nextKey = approvalsSyncKey(initialApprovals);
    if (prevSyncKeyRef.current === nextKey) {
      return;
    }
    prevSyncKeyRef.current = nextKey;
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
