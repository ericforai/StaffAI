'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/tasks/${taskId}`);
      const payload = (await response.json()) as TaskDetailPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '任务详情加载失败。');
      }
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
