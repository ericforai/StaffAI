'use client';

import { useState } from 'react';
import { apiClient } from '../lib/api-client';
import type { TaskDetailPayload } from '../types';

export type TaskExecutor = 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow';

export function useTaskActions(taskId: string, onTaskUpdated?: (payload: TaskDetailPayload) => void) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshTask() {
    try {
      const payload = await apiClient.get<TaskDetailPayload>(`/tasks/${taskId}`);
      onTaskUpdated?.(payload);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '任务详情刷新失败。');
    }
  }

  async function executeTask(executor: TaskExecutor = 'claude') {
    try {
      setSubmitting(true);
      setError(null);
      await apiClient.post(`/tasks/${taskId}/execute`, {
        executor,
        summary: 'Execution finished from the task workspace',
      });
      await refreshTask();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '任务执行失败。');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 统一的任务控制操作（暂停、恢复、取消）
   */
  async function controlTask(executionId: string, action: 'pause' | 'resume' | 'cancel') {
    try {
      setSubmitting(true);
      setError(null);
      await apiClient.post(`/executions/${executionId}/${action}`, undefined, {
        headers: { 'X-Agency-Control': '1' }
      });
      
      await refreshTask();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : `操作 ${action} 失败。`);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    executeTask,
    pauseTask: (executionId: string) => controlTask(executionId, 'pause'),
    resumeTask: (executionId: string) => controlTask(executionId, 'resume'),
    cancelTask: (executionId: string) => controlTask(executionId, 'cancel'),
    submitting,
    error,
  };
}
