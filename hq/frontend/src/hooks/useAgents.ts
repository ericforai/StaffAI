/**
 * Agent 状态管理 Hook
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Agent } from '../types';
import { apiClient } from '../lib/api-client';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载所有 agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await apiClient.get<Agent[]>('/agents');
        setAgents(data);
      } catch (err) {
        console.error('Failed to load agents:', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  // 加载活跃 squad
  useEffect(() => {
    const fetchSquad = async () => {
      try {
        const data = await apiClient.get<{ activeAgentIds: string[] }>('/squad');
        setActiveIds(data.activeAgentIds || []);
      } catch (err) {
        console.error('Failed to load squad:', err instanceof Error ? err.message : 'Unknown error');
      }
    };
    fetchSquad();
  }, []);

  // 计算活跃 agents
  const activeAgents = useMemo(
    () => agents.filter(a => activeIds.includes(a.id)),
    [agents, activeIds]
  );

  // 切换 agent 状态
  const toggleAgent = useCallback(async (id: string) => {
    const newIds = activeIds.includes(id)
      ? activeIds.filter(x => x !== id)
      : [...activeIds, id];

    setActiveIds(newIds);

    try {
      await apiClient.post('/squad', { activeAgentIds: newIds });
    } catch (err) {
      console.error('Failed to update squad:', err);
    }
  }, [activeIds]);

  // 保存 squad
  const saveSquad = useCallback(async (newIds: string[]) => {
    setActiveIds(newIds);

    try {
      await apiClient.post('/squad', { activeAgentIds: newIds });
    } catch (err) {
      console.error('Failed to save squad:', err);
    }
  }, []);

  // 同步 squad（从后端）
  const syncSquad = useCallback(async () => {
    try {
      const data = await apiClient.get<{ activeAgentIds: string[] }>('/squad');
      console.debug('[useAgents] Syncing squad:', data.activeAgentIds?.length ?? 0, 'agents');
      setActiveIds(data.activeAgentIds || []);
    } catch (err) {
      console.error('Failed to sync squad:', err);
    }
  }, []);

  return {
    agents,
    activeIds,
    activeAgents,
    loading,
    toggleAgent,
    saveSquad,
    syncSquad,
    setActiveIds,
  };
}
