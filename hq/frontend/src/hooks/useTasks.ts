'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { TaskSummary } from '../types';

export function useTasks() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadTasks = useCallback(async () => {
    if (cancelledRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/tasks`);
      const payload = (await response.json()) as { tasks?: TaskSummary[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '任务列表加载失败。');
      }
      if (!cancelledRef.current) {
        setTasks(payload.tasks || []);
      }
    } catch (requestError) {
      if (!cancelledRef.current) {
        setError(requestError instanceof Error ? requestError.message : '任务列表加载失败。');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void loadTasks();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadTasks]);

  return { tasks, loading, error, setTasks, reload: loadTasks };
}
