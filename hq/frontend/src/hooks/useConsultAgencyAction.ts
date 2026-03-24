import { useState } from 'react';
import { API_CONFIG } from '../utils/constants';

export interface ConsultAgencyResult {
  task: string;
  text: string;
  executor?: string;
  agentId?: string;
  agentName?: string;
  raw: unknown;
}

interface ConsultAgencyApiResponse {
  text?: unknown;
  result?: unknown;
  response?: unknown;
  content?: unknown;
  executor?: unknown;
  agentId?: unknown;
  agentName?: unknown;
  error?: string;
}

function extractText(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    const nestedText = payload
      .map((item) => extractText(item))
      .filter(Boolean)
      .join('\n')
      .trim();
    return nestedText;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (typeof record.text === 'string') {
      return record.text.trim();
    }

    if (typeof record.response === 'string') {
      return record.response.trim();
    }

    if (typeof record.summary === 'string') {
      return record.summary.trim();
    }

    if (typeof record.content !== 'undefined') {
      return extractText(record.content);
    }

    if (typeof record.result !== 'undefined') {
      return extractText(record.result);
    }

    if (Array.isArray(record.parts)) {
      return extractText(record.parts);
    }
  }

  return '';
}

function normalizeResult(task: string, data: ConsultAgencyApiResponse): ConsultAgencyResult {
  const text =
    extractText(data.text) ||
    extractText(data.response) ||
    extractText(data.result) ||
    extractText(data.content) ||
    extractText(data);

  return {
    task,
    text: text || '没有返回可展示内容。',
    executor: typeof data.executor === 'string' ? data.executor : undefined,
    agentId: typeof data.agentId === 'string' ? data.agentId : undefined,
    agentName: typeof data.agentName === 'string' ? data.agentName : undefined,
    raw: data,
  };
}

export function useConsultAgencyAction(initialTask = '') {
  const [task, setTask] = useState(initialTask);
  const [result, setResult] = useState<ConsultAgencyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = async (overrideTask?: string) => {
    const nextTask = (overrideTask ?? task).trim();
    if (!nextTask) {
      setError('先输入一个任务，我们再调用 consult_the_agency。');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/mcp/consult-the-agency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: nextTask }),
      });

      const data = (await response.json()) as ConsultAgencyApiResponse;
      if (!response.ok) {
        throw new Error(data.error || 'consult_the_agency 执行失败。');
      }

      const normalized = normalizeResult(nextTask, data);
      setResult(normalized);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'consult_the_agency 执行失败。';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    task,
    setTask,
    result,
    error,
    loading,
    execute,
    reset,
  };
}
