'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { API_CONFIG } from '../utils/constants';
import type { TaskSummary, TaskAttachment } from '../types';

export interface UploadingFile {
  file: File;
  progress: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  attachment?: TaskAttachment;
}

export function useTaskComposer(onTaskCreated?: (task: TaskSummary) => void) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const uploadFiles = useCallback(async (files: File[]): Promise<TaskAttachment[]> => {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/uploads`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `上传失败: ${response.status}`);
    }

    const data = await response.json();
    return data.attachments as TaskAttachment[];
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const newEntries: UploadingFile[] = files.map((file) => ({
      file,
      progress: 'uploading' as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newEntries]);
    setError(null);

    try {
      const attachments = await uploadFiles(files);
      setUploadingFiles((prev) =>
        prev.map((entry) => {
          const idx = files.indexOf(entry.file);
          if (idx >= 0 && attachments[idx]) {
            return { ...entry, progress: 'done' as const, attachment: attachments[idx] };
          }
          return entry;
        })
      );
    } catch (uploadError) {
      const msg = uploadError instanceof Error ? uploadError.message : '文件上传失败';
      setUploadingFiles((prev) =>
        prev.map((entry) =>
          files.includes(entry.file) ? { ...entry, progress: 'error' as const, error: msg } : entry
        )
      );
      setError(msg);
    }
  }, [uploadFiles]);

  const removeFile = useCallback((index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function createTask() {
    try {
      setSubmitting(true);
      setError(null);

      const attachments = uploadingFiles
        .filter((f) => f.progress === 'done' && f.attachment)
        .map((f) => f.attachment!);
      
      const payload = await apiClient.post<{ task: TaskSummary }>(`/tasks`, {
        title,
        description,
        assigneeId: assigneeId || undefined,
        assigneeName: assigneeName || undefined,
        priority,
        ...(attachments.length > 0 ? { attachments } : {}),
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
      setUploadingFiles([]);
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
    uploadingFiles,
    addFiles,
    removeFile,
    createTask,
  };
}
