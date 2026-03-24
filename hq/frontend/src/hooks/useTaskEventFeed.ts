'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { TaskEvent } from '../types';
import {
  normalizeTaskEventFeed,
  projectLatestSurfaceSummary,
  projectLatestTaskEventByTaskId,
  projectLatestTaskEventSummaryByTaskId,
} from '../lib/taskEventProjection';

export function useTaskEventFeed() {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTaskEvents() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_CONFIG.BASE_URL}/task-events`);
        const payload = (await response.json()) as { events?: unknown; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || '任务事件加载失败。');
        }
        if (!cancelled) {
          setEvents(normalizeTaskEventFeed(payload.events));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : '任务事件加载失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTaskEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestEventByTaskId = useMemo(() => {
    return projectLatestTaskEventByTaskId(events);
  }, [events]);

  const latestSummaryByTaskId = useMemo(() => projectLatestTaskEventSummaryByTaskId(events), [events]);

  const latestTaskWorkspaceSummary = useMemo(() => projectLatestSurfaceSummary(events, 'tasks'), [events]);
  const latestApprovalWorkspaceSummary = useMemo(() => projectLatestSurfaceSummary(events, 'approvals'), [events]);
  const latestExecutionWorkspaceSummary = useMemo(() => projectLatestSurfaceSummary(events, 'executions'), [events]);

  return {
    events,
    latestEventByTaskId,
    latestSummaryByTaskId,
    latestTaskWorkspaceSummary,
    latestApprovalWorkspaceSummary,
    latestExecutionWorkspaceSummary,
    loading,
    error,
  };
}
