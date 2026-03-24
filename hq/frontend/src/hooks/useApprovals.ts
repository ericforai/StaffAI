'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/approvals`);
      const payload = (await response.json()) as { approvals?: ApprovalSummary[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '审批列表加载失败。');
      }
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
