'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AgentMemory } from '../types/domain';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export function useAgentMemory(agentId: string) {
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/agents/${agentId}/memory`);
      if (!res.ok) {
        if (res.status === 404) {
          setMemory(null);
          return;
        }
        throw new Error(`Failed to load memory: ${res.status}`);
      }
      const data = await res.json();
      setMemory(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  return { memory, loading, error, reload: loadMemory };
}
