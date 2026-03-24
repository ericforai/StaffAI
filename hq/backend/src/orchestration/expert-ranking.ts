import type { Agent } from '../types';

export interface RankedExpert {
  agent: Agent;
  score: number;
  isActive: boolean;
}

export function getFeatures(text: string): Map<string, number> {
  const features = new Map<string, number>();
  const words = text
    .toLowerCase()
    .split(/[\s,，.。!！?？\-_/():]+/)
    .filter((token) => token.length > 0);

  for (const word of words) {
    features.set(word, (features.get(word) || 0) + 1);
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/[\u4e00-\u9fa5]/.test(char)) {
      features.set(char, (features.get(char) || 0) + 1);
    }
  }

  return features;
}

export function calculateSmartScore(agent: Agent, task: string): number {
  const taskFeatures = getFeatures(task);
  const nameFeatures = getFeatures(agent.frontmatter.name);
  const descFeatures = getFeatures(agent.frontmatter.description);
  const idFeatures = getFeatures(agent.id);

  let score = 0;
  taskFeatures.forEach((count, feature) => {
    if (nameFeatures.has(feature)) score += count * nameFeatures.get(feature)! * 10;
    if (idFeatures.has(feature)) score += count * idFeatures.get(feature)! * 8;
    if (descFeatures.has(feature)) score += count * descFeatures.get(feature)! * 2;
  });

  return score;
}

export function rankExperts(input: {
  agents: Agent[];
  topic: string;
  activeIds: Set<string>;
  maxExperts: number;
}): RankedExpert[] {
  const ranked = input.agents
    .map((agent) => ({
      agent,
      score: calculateSmartScore(agent, input.topic),
      isActive: input.activeIds.has(agent.id),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }
      return left.agent.frontmatter.name.localeCompare(right.agent.frontmatter.name);
    });

  const capped = Math.min(Math.max(input.maxExperts, 1), 8);
  const meaningful = ranked.filter((entry) => entry.score > 0).slice(0, capped);
  if (meaningful.length > 0) {
    if (meaningful.length >= capped) {
      return meaningful;
    }

    const selectedIds = new Set(meaningful.map((entry) => entry.agent.id));
    const fillers = ranked.filter((entry) => !selectedIds.has(entry.agent.id)).slice(0, capped - meaningful.length);
    return [...meaningful, ...fillers];
  }

  return ranked.slice(0, capped);
}
