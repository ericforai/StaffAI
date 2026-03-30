'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import type { TaskEvent } from '../types';
import { normalizeTaskEventFeed } from '../lib/taskEventProjection';

export function useTaskEvents(taskId: string) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await apiFetch<{ events?: unknown }>('/task-events');

      const filtered = normalizeTaskEventFeed(payload.events).filter((event) => event.taskId === taskId);
      setEvents(filtered);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '任务事件加载失败。');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const pushEvent = useCallback(
    (event: TaskEvent) => {
      if (event.taskId !== taskId) {
        return;
      }
      setEvents((previous) => normalizeTaskEventFeed([event, ...previous]).slice(0, 50));
    },
    [taskId]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await refresh();
      if (cancelled) {
        return;
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { events, loading, error, refresh, pushEvent };
}
