'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiError } from '../lib/api-client';
import type { PendingHumanInput } from '../types/hitl-types';

export function usePendingHumanInputs(taskId: string) {
  const [inputs, setInputs] = useState<PendingHumanInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!taskId || cancelledRef.current) return;

    setLoading(true);
    setError(null);
    try {
      const payload = await apiClient.get<{ inputs: PendingHumanInput[] }>(
        `/tasks/${taskId}/pending-human-inputs`
      );
      if (!cancelledRef.current) {
        setInputs(payload.inputs ?? []);
      }
    } catch (requestError) {
      if (!cancelledRef.current) {
        setError(requestError instanceof Error ? requestError.message : '加载待处理输入失败');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [taskId]);

  const respondToAssignment = useCallback(
    async (assignmentId: string, answer: string, answeredBy?: string) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await apiClient.post(
          `/assignments/${assignmentId}/respond`,
          { answer, answeredBy },
          {}
        );
        // Refresh the list after successful submission
        await load();
      } catch (err) {
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : '提交失败，请重试'
        );
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [load]
  );

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return {
    inputs,
    loading,
    error,
    submitting,
    submitError,
    respondToAssignment,
    reload: load,
  };
}
