'use client';

import { useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { TaskDetailPayload } from '../types';

export type TaskExecutor = 'openai' | 'codex' | 'claude';

export function useTaskActions(taskId: string, onTaskUpdated?: (payload: TaskDetailPayload) => void) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshTask() {
    const response = await fetch(`${API_CONFIG.BASE_URL}/tasks/${taskId}`);
    const payload = (await response.json()) as TaskDetailPayload & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || '任务详情刷新失败。');
    }
    onTaskUpdated?.(payload);
  }

  async function executeTask(executor: TaskExecutor = 'claude') {
    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/tasks/${taskId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executor,
          summary: 'Execution finished from the task workspace',
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '任务执行失败。');
      }
      await refreshTask();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '任务执行失败。');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    executeTask,
    submitting,
    error,
  };
}
