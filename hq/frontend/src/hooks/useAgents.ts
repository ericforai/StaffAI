/**
 * Agent 状态管理 Hook
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Agent } from '../types';
import { API_CONFIG } from '../utils/constants';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载所有 agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const url = `${API_CONFIG.BASE_URL}/agents`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch agents failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        setAgents(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to load agents from ${API_CONFIG.BASE_URL}/agents:`, errorMessage);
        console.error('Ensure backend is running on port 3333');
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
        const url = `${API_CONFIG.BASE_URL}/squad`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch squad failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        setActiveIds(data.activeAgentIds || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to load squad from ${API_CONFIG.BASE_URL}/squad:`, errorMessage);
        console.error('Ensure backend is running on port 3333');
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

    await fetch(`${API_CONFIG.BASE_URL}/squad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeAgentIds: newIds })
    }).catch(err => console.error('Failed to update squad:', err));
  }, [activeIds]);

  // 保存 squad
  const saveSquad = useCallback(async (newIds: string[]) => {
    setActiveIds(newIds);

    await fetch(`${API_CONFIG.BASE_URL}/squad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeAgentIds: newIds })
    }).catch(err => console.error('Failed to save squad:', err));
  }, []);

  // 同步 squad（从后端）
  const syncSquad = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/squad`);
      const data = await res.json();
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
