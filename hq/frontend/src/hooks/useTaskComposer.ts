'use client';

import { useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import type { TaskSummary } from '../types';

export function useTaskComposer(onTaskCreated?: (task: TaskSummary) => void) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTask() {
    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
        }),
      });

      const payload = (await response.json()) as { task?: TaskSummary; error?: string };
      if (!response.ok || !payload.task) {
        throw new Error(payload.error || '任务创建失败。');
      }

      onTaskCreated?.(payload.task);
      setTitle('');
      setDescription('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '任务创建失败。');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    submitting,
    error,
    createTask,
  };
}
