'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

export interface ExecutionTracePayload {
  trace?: {
    execution?: { id: string; taskId: string; status: string };
    traceEvents?: Array<{ id: string; type: string; occurredAt: string; summary?: string }>;
    costLogs?: Array<{ id: string; recordedAt: string; tokensUsed?: number }>;
  };
  error?: string;
}

export function useExecutionTrace(executionId: string) {
  const [data, setData] = useState<ExecutionTracePayload['trace'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (cancelledRef.current) {
      return;
    }
    if (!executionId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<ExecutionTracePayload>(`/executions/${executionId}/trace`);
      if (!cancelledRef.current) {
        setData(payload.trace ?? null);
      }
    } catch (requestError) {
      if (!cancelledRef.current) {
        setData(null);
        setError(requestError instanceof Error ? requestError.message : '执行轨迹加载失败。');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [executionId]);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return { trace: data, loading, error, reload: load };
}

