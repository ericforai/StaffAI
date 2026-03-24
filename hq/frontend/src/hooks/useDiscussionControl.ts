import { useMemo, useState } from 'react';
import { API_CONFIG } from '../utils/constants';
import { Agent } from '../types';

export interface DiscussionExpert {
  id: string;
  name: string;
  description: string;
  department: string;
  score: number;
  isActive: boolean;
}

export interface DiscussionParticipant extends DiscussionExpert {
  hiredForTask: boolean;
  assignment: string;
  response?: string;
}

export interface DiscussionRunResult {
  topic: string;
  participants: DiscussionParticipant[];
  synthesis: string;
  executor?: 'codex' | 'claude' | 'openai';
  degraded?: boolean;
  notice?: string;
}

interface UseDiscussionControlOptions {
  agents: Agent[];
  activeIds: string[];
}

export function useDiscussionControl({ agents, activeIds }: UseDiscussionControlOptions) {
  const [topic, setTopic] = useState('');
  const [participantCount, setParticipantCount] = useState(3);
  const [experts, setExperts] = useState<DiscussionExpert[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [result, setResult] = useState<DiscussionRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [running, setRunning] = useState(false);

  const selectedExperts = useMemo(
    () => experts.filter((expert) => selectedAgentIds.includes(expert.id)),
    [experts, selectedAgentIds]
  );

  const hydrateExperts = (agentIds: string[]) => {
    const merged = new Map<string, DiscussionExpert>();

    for (const expert of experts) {
      merged.set(expert.id, expert);
    }

    for (const agentId of agentIds) {
      if (merged.has(agentId)) {
        continue;
      }

      const agent = agents.find((entry) => entry.id === agentId);
      if (!agent) {
        continue;
      }

      merged.set(agent.id, {
        id: agent.id,
        name: agent.frontmatter.name,
        description: agent.frontmatter.description,
        department: agent.department,
        score: 0,
        isActive: activeIds.includes(agent.id),
      });
    }

    return Array.from(merged.values());
  };

  const toggleSelection = (agentId: string) => {
    setSelectedAgentIds((current) =>
      current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]
    );
  };

  const searchExperts = async () => {
    if (!topic.trim()) {
      setError('先输入一个讨论主题，我们再去找合适的专家。');
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/discussions/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, participantCount }),
      });

      const data = (await response.json()) as { error?: string; experts?: DiscussionExpert[] };
      if (!response.ok || !data.experts) {
        throw new Error(data.error || '专家搜索失败。');
      }

      setExperts(data.experts);
      setSelectedAgentIds(data.experts.slice(0, participantCount).map((expert) => expert.id));
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '专家搜索失败。');
    } finally {
      setSearching(false);
    }
  };

  const hireSelectedExperts = async () => {
    if (selectedAgentIds.length === 0) {
      setError('先选定至少一位专家，再执行招聘。');
      return;
    }

    setHiring(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/discussions/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentIds: selectedAgentIds }),
      });

      const data = (await response.json()) as {
        error?: string;
        hired?: DiscussionExpert[];
        alreadyActive?: DiscussionExpert[];
      };

      if (!response.ok) {
        throw new Error(data.error || '招聘失败。');
      }

      setExperts((current) =>
        current.map((expert) =>
          selectedAgentIds.includes(expert.id) ? { ...expert, isActive: true } : expert
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '招聘失败。');
    } finally {
      setHiring(false);
    }
  };

  const runDiscussion = async () => {
    if (!topic.trim()) {
      setError('先输入一个讨论主题。');
      return;
    }

    const agentIds = selectedAgentIds.length > 0 ? selectedAgentIds : undefined;

    setRunning(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/discussions/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, participantCount, agentIds }),
      });

      const data = (await response.json()) as DiscussionRunResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '讨论执行失败。');
      }

      setResult(data);
      setExperts((current) =>
        current.map((expert) => {
          const participant = data.participants.find((entry) => entry.id === expert.id);
          return participant ? { ...expert, isActive: true } : expert;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '讨论执行失败。');
    } finally {
      setRunning(false);
    }
  };

  const applyTemplateSelection = (agentIds: string[]) => {
    const uniqueIds = Array.from(new Set(agentIds));
    setExperts(hydrateExperts(uniqueIds));
    setSelectedAgentIds(uniqueIds);
    if (uniqueIds.length > 0) {
      setParticipantCount(Math.min(4, Math.max(2, uniqueIds.length)));
    }
    setResult(null);
    setError(null);
  };

  return {
    topic,
    setTopic,
    participantCount,
    setParticipantCount,
    experts,
    selectedAgentIds,
    selectedExperts,
    result,
    error,
    searching,
    hiring,
    running,
    toggleSelection,
    searchExperts,
    hireSelectedExperts,
    runDiscussion,
    applyTemplateSelection,
  };
}
