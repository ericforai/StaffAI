import { useState, useCallback } from 'react';
import { API_CONFIG } from '../utils/constants';

export interface DiscussionParticipantResult {
  id: string;
  name: string;
  description: string;
  department: string;
  score: number;
  isActive: boolean;
  hiredForTask: boolean;
  assignment: string;
  response?: string;
}

export interface ExpertDiscussionResult {
  topic: string;
  participants: DiscussionParticipantResult[];
  synthesis: string;
  executor?: 'claude' | 'codex' | 'openai';
  capabilities?: { sampling: boolean };
  executionModeRequested?: ExecutionMode;
  executionModeApplied?: 'parallel' | 'serial' | null;
  degraded?: boolean;
  notice?: string;
}

export type ExecutionMode = 'auto' | 'force_serial' | 'require_sampling';

interface StructuredAction {
  key: 'switch_client' | 'auto_downgrade' | 'single_expert';
  label: string;
  description: string;
}

interface StructuredError {
  reason?: string;
  impact?: string;
  actions?: StructuredAction[];
}

interface UseExpertDiscussionActionState {
  topic: string;
  participantCount: number;
  agentIds: string[];
}

const DEFAULT_PARTICIPANT_COUNT = 3;

export function useExpertDiscussionAction() {
  const [topic, setTopic] = useState('');
  const [participantCount, setParticipantCount] = useState(DEFAULT_PARTICIPANT_COUNT);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('auto');
  const [capabilities, setCapabilities] = useState<{ sampling: boolean } | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [result, setResult] = useState<ExpertDiscussionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<StructuredError | null>(null);

  const reset = () => {
    setTopic('');
    setParticipantCount(DEFAULT_PARTICIPANT_COUNT);
    setAgentIds([]);
    setExecutionMode('auto');
    setResult(null);
    setError(null);
    setErrorDetails(null);
    setLoading(false);
  };

  const setDiscussionState = (nextState: Partial<UseExpertDiscussionActionState>) => {
    if (typeof nextState.topic === 'string') {
      setTopic(nextState.topic);
    }
    if (typeof nextState.participantCount === 'number') {
      setParticipantCount(nextState.participantCount);
    }
    if (Array.isArray(nextState.agentIds)) {
      setAgentIds(nextState.agentIds);
    }
  };

  const toggleAgentId = (agentId: string) => {
    setAgentIds((current) =>
      current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]
    );
  };

  const refreshCapabilities = useCallback(async () => {
    setCapabilitiesLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/mcp/capabilities`);
      if (!response.ok) {
        return capabilities;
      }
      const data = (await response.json()) as { capabilities?: { sampling?: unknown } };
      const nextCapabilities = {
        sampling: Boolean(data.capabilities?.sampling),
      };
      setCapabilities(nextCapabilities);
      return nextCapabilities;
    } catch {
      return capabilities;
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [capabilities]);

  const runDiscussion = async (override?: Partial<UseExpertDiscussionActionState>) => {
    const nextTopic = override?.topic ?? topic;
    const nextParticipantCount = override?.participantCount ?? participantCount;
    const nextAgentIds = override?.agentIds ?? agentIds;

    if (!nextTopic.trim()) {
      setError('先输入讨论主题，再运行讨论。');
      return null;
    }

    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const nextCapabilities = await refreshCapabilities();
      if (executionMode === 'require_sampling' && !nextCapabilities?.sampling) {
        const blockedError: StructuredError = {
          reason: '当前客户端未开启 sampling 能力。',
          impact: '无法并行执行多专家讨论。',
          actions: [
            { key: 'switch_client', label: '切换支持端', description: '切换支持 sampling 的客户端。' },
            { key: 'auto_downgrade', label: '自动降级', description: '将执行模式切回 auto。' },
            { key: 'single_expert', label: '继续单专家', description: '改用 consult_the_agency。' },
          ],
        };
        setError(`${blockedError.reason}${blockedError.impact}`);
        setErrorDetails(blockedError);
        return null;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/mcp/expert-discussion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: nextTopic,
          participantCount: nextParticipantCount,
          agentIds: nextAgentIds,
          executionMode,
        }),
      });

      const data = (await response.json()) as ExpertDiscussionResult &
        StructuredError & {
          error?: string;
        };
      if (!response.ok) {
        setErrorDetails({
          reason: data.reason,
          impact: data.impact,
          actions: data.actions,
        });
        throw new Error(data.error || 'expert_discussion 执行失败。');
      }

      setResult(data);
      if (data.capabilities) {
        setCapabilities(data.capabilities);
      }
      setTopic(nextTopic);
      setParticipantCount(nextParticipantCount);
      setAgentIds(nextAgentIds);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'expert_discussion 执行失败。';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    topic,
      participantCount,
      agentIds,
      executionMode,
      capabilities,
      capabilitiesLoading,
      result,
      loading,
      error,
      errorDetails,
      setTopic,
      setParticipantCount,
      setAgentIds,
      setExecutionMode,
      setDiscussionState,
      toggleAgentId,
      refreshCapabilities,
      runDiscussion,
      reset,
    };
}
