/**
 * Elite Skills Hook
 */
import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api-client';
import type { EliteSkill, CreateSkillInput } from '../lib/api-client';

interface UseEliteSkillsOptions {
  includeAll?: boolean;
}

export function useEliteSkills(options: UseEliteSkillsOptions = {}) {
  const { includeAll = false } = options;
  const [skills, setSkills] = useState<EliteSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = includeAll ? await api.getAllEliteSkills() : await api.getEliteSkills();
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [includeAll]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const createSkill = useCallback(async (input: CreateSkillInput) => {
    const skill = await api.createEliteSkill(input);
    setSkills(prev => [...prev, skill]);
    return skill;
  }, []);

  const updateSkill = useCallback(async (id: string, input: Partial<CreateSkillInput>) => {
    const updated = await api.updateEliteSkill(id, input);
    setSkills(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  const deleteSkill = useCallback(async (id: string) => {
    await api.deleteEliteSkill(id);
    setSkills(prev => prev.filter(s => s.id !== id));
  }, []);

  const publishSkill = useCallback(async (id: string) => {
    const updated = await api.publishEliteSkill(id);
    setSkills(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  const deprecateSkill = useCallback(async (id: string) => {
    const updated = await api.deprecateEliteSkill(id);
    setSkills(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  return {
    skills,
    loading,
    error,
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    publishSkill,
    deprecateSkill,
  };
}

export function useEliteSkill(skillId: string) {
  const [skill, setSkill] = useState<EliteSkill | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkill = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [skillData, contentData] = await Promise.all([
        api.getEliteSkill(skillId),
        api.getEliteSkillContent(skillId),
      ]);
      setSkill(skillData);
      setContent(contentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  return { skill, content, loading, error, refetch: fetchSkill };
}
