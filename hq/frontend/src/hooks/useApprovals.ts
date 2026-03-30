'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import type { ApprovalSummary } from '../types';

export function useApprovals() {
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadApprovals = useCallback(async () => {
    if (cancelledRef.current) {
      return;
    }

    if (!cancelledRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const payload = await apiFetch<{ approvals?: ApprovalSummary[] }>('/approvals');
      if (!cancelledRef.current) {
        setApprovals(payload.approvals || []);
      }
    } catch (requestError) {
      if (!cancelledRef.current) {
        setError(requestError instanceof Error ? requestError.message : '审批列表加载失败。');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void loadApprovals();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadApprovals]);

  return { approvals, loading, error, reload: loadApprovals };
}
