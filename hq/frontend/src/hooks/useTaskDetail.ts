'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import type { TaskDetailPayload } from '../types';

export function useTaskDetail(taskId: string) {
  const [data, setData] = useState<TaskDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadTaskDetail = useCallback(async () => {
    if (!taskId || cancelledRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<TaskDetailPayload>(`/tasks/${taskId}`);
      if (!cancelledRef.current) {
        setData(payload);
      }
    } catch (requestError) {
      if (!cancelledRef.current) {
        setData(null);
        setError(requestError instanceof Error ? requestError.message : '任务详情加载失败。');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [taskId]);

  useEffect(() => {
    cancelledRef.current = false;
    void loadTaskDetail();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadTaskDetail]);

  return { data, loading, error, setData, reload: loadTaskDetail };
}
