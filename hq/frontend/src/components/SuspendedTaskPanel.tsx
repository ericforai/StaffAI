'use client';

import { useState } from 'react';
import { API_CONFIG } from '../utils/constants';

interface SuspendedTaskPanelProps {
  taskId: string;
  onResumed: (updatedTask: any) => void;
}

export function SuspendedTaskPanel({ taskId, onResumed }: SuspendedTaskPanelProps) {
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResume() {
    if (!feedbackText.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/tasks/${taskId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackText: feedbackText.trim(),
          feedbackType: 'approval'
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Resume failed');
      }

      onResumed(data.task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        <h3 className="text-sm font-semibold text-amber-800">任务已暂停 - 等待人工反馈</h3>
      </div>
      <textarea
        value={feedbackText}
        onChange={(e) => setFeedbackText(e.target.value)}
        placeholder="请输入反馈内容..."
        className="w-full p-2 border border-amber-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
        rows={3}
      />
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={handleResume}
        disabled={!feedbackText.trim() || submitting}
        className="mt-2 px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? '提交中...' : '提交反馈并恢复任务'}
      </button>
    </div>
  );
}
