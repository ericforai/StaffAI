'use client';

import { useState } from 'react';
import { apiClient } from '../lib/api-client';
import type { TaskSummary } from '../types';

export function useTaskComposer(onTaskCreated?: (task: TaskSummary) => void) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTask() {
    try {
      setSubmitting(true);
      setError(null);
      
      const payload = await apiClient.post<{ task: TaskSummary }>(`/tasks`, {
        title,
        description,
        assigneeId: assigneeId || undefined,
        assigneeName: assigneeName || undefined,
        priority,
      });

      if (!payload.task) {
        throw new Error('服务器未返回任务数据');
      }

      onTaskCreated?.(payload.task);
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setAssigneeName('');
      setPriority('medium');
      return payload.task;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '任务创建失败。');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    assigneeId,
    setAssigneeId,
    assigneeName,
    setAssigneeName,
    priority,
    setPriority,
    submitting,
    error,
    createTask,
  };
}
