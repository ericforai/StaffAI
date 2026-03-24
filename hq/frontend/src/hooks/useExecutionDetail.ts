'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { ExecutionSummary } from '../types';

export function useExecutionDetail(executionId: string) {
  const [execution, setExecution] = useState<ExecutionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const cancelledRef = useRef(false);

  const loadExecution = useCallback(async () => {
    if (cancelledRef.current) {
      return;
    }

    if (!executionId) {
      setExecution(null);
      setError(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/executions/${executionId}`);
      const payload = (await response.json()) as { execution?: ExecutionSummary | null; error?: string };
      if (response.status === 404) {
        if (!cancelledRef.current) {
          setExecution(null);
          setNotFound(true);
        }
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error || '执行详情加载失败。');
      }
      if (!cancelledRef.current) {
        setExecution(payload.execution || null);
        setNotFound(!(payload.execution || null));
      }
    } catch (requestError) {
      if (!cancelledRef.current) {
        setExecution(null);
        setNotFound(false);
        setError(requestError instanceof Error ? requestError.message : '执行详情加载失败。');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [executionId]);

  useEffect(() => {
    cancelledRef.current = false;
    void loadExecution();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadExecution]);

  return { execution, loading, error, notFound, reload: loadExecution };
}
