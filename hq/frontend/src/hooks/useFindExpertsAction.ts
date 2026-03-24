import { useState } from 'react';
import { API_CONFIG } from '../utils/constants';

export interface FindExpertCandidate {
  id: string;
  name: string;
  description: string;
  department: string;
  score: number;
  isActive: boolean;
}

export interface FindExpertsResult {
  topic: string;
  experts: FindExpertCandidate[];
}

interface UseFindExpertsActionOptions {
  initialTopic?: string;
  initialMaxExperts?: number;
}

interface FindExpertsRequest {
  topic?: string;
  maxExperts?: number;
}

const MIN_EXPERTS = 1;
const MAX_EXPERTS = 8;

function clampMaxExperts(value: number) {
  if (!Number.isFinite(value)) {
    return 4;
  }

  return Math.min(MAX_EXPERTS, Math.max(MIN_EXPERTS, Math.floor(value)));
}

function normalizeTopic(value: string) {
  return value.trim();
}

export function useFindExpertsAction(options: UseFindExpertsActionOptions = {}) {
  const [topic, setTopic] = useState(options.initialTopic ?? '');
  const [maxExperts, setMaxExperts] = useState(clampMaxExperts(options.initialMaxExperts ?? 4));
  const [result, setResult] = useState<FindExpertsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const findExperts = async (overrides: FindExpertsRequest = {}) => {
    const nextTopic = normalizeTopic(overrides.topic ?? topic);
    const nextMaxExperts = clampMaxExperts(overrides.maxExperts ?? maxExperts);

    if (!nextTopic) {
      setError('先输入一个主题，再去搜索专家。');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/mcp/find-experts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: nextTopic,
          maxExperts: nextMaxExperts,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        topic?: string;
        experts?: FindExpertCandidate[];
      };

      if (!response.ok || !data.experts) {
        throw new Error(data.error || '专家搜索失败。');
      }

      const nextResult: FindExpertsResult = {
        topic: data.topic ?? nextTopic,
        experts: data.experts,
      };

      setTopic(nextTopic);
      setMaxExperts(nextMaxExperts);
      setResult(nextResult);
      return nextResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : '专家搜索失败。';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTopic(options.initialTopic ?? '');
    setMaxExperts(clampMaxExperts(options.initialMaxExperts ?? 4));
    setResult(null);
    setError(null);
    setLoading(false);
  };

  return {
    topic,
    setTopic,
    maxExperts,
    setMaxExperts,
    result,
    error,
    loading,
    findExperts,
    reset,
  };
}
