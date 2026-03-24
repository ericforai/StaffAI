import { useState } from 'react';
import { API_CONFIG } from '../utils/constants';

export interface HireExpertsAgent {
  id: string;
  name: string;
  description: string;
  department: string;
}

export interface HireExpertsResult {
  hired: HireExpertsAgent[];
  alreadyActive: HireExpertsAgent[];
  missing: string[];
}

interface UseHireExpertsActionOptions {
  initialAgentIds?: string[];
}

interface HireExpertsApiResponse extends Partial<HireExpertsResult> {
  error?: string;
}

function normalizeAgentIds(agentIds: string[]) {
  return Array.from(
    new Set(
      agentIds
        .map((agentId) => agentId.trim())
        .filter((agentId) => agentId.length > 0)
    )
  );
}

export function useHireExpertsAction({ initialAgentIds = [] }: UseHireExpertsActionOptions = {}) {
  const [agentIds, setAgentIds] = useState<string[]>(normalizeAgentIds(initialAgentIds));
  const [result, setResult] = useState<HireExpertsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = async (overrideAgentIds?: string[]) => {
    const nextAgentIds = normalizeAgentIds(overrideAgentIds ?? agentIds);
    setAgentIds(nextAgentIds);

    if (nextAgentIds.length === 0) {
      const message = '先提供至少一位专家 ID，再执行雇佣。';
      setError(message);
      setResult(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/mcp/hire-experts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentIds: nextAgentIds }),
      });

      const data = (await response.json()) as HireExpertsApiResponse;
      if (!response.ok) {
        throw new Error(data.error || '雇佣专家失败。');
      }

      const nextResult: HireExpertsResult = {
        hired: data.hired ?? [],
        alreadyActive: data.alreadyActive ?? [],
        missing: data.missing ?? [],
      };
      setResult(nextResult);
      return nextResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : '雇佣专家失败。';
      setError(message);
      setResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addAgentId = (agentId: string) => {
    const nextAgentId = agentId.trim();
    if (!nextAgentId) {
      return;
    }

    setAgentIds((current) => {
      if (current.includes(nextAgentId)) {
        return current;
      }
      return [...current, nextAgentId];
    });
  };

  const removeAgentId = (agentId: string) => {
    const nextAgentId = agentId.trim();
    if (!nextAgentId) {
      return;
    }

    setAgentIds((current) => current.filter((currentId) => currentId !== nextAgentId));
  };

  const clear = () => {
    setAgentIds([]);
    setResult(null);
    setError(null);
  };

  return {
    agentIds,
    setAgentIds,
    addAgentId,
    removeAgentId,
    clear,
    result,
    error,
    loading,
    execute,
  };
}
