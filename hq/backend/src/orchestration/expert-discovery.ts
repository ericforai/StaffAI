import type { Agent } from '../types';
import {
  rankExperts as rankExpertsBySignal,
  type RankedExpert,
} from './expert-ranking';

export interface ExpertCandidate {
  id: string;
  name: string;
  description: string;
  department: string;
  score: number;
  isActive: boolean;
}

interface ExpertDiscoveryDependencies {
  getAllAgents: () => Agent[];
  getActiveIds: () => string[];
}

function toCandidate(agent: Agent, score: number, isActive: boolean): ExpertCandidate {
  return {
    id: agent.id,
    name: agent.frontmatter.name,
    description: agent.frontmatter.description,
    department: agent.department,
    score,
    isActive,
  };
}

export function createExpertDiscoveryService(dependencies: ExpertDiscoveryDependencies) {
  function rankExperts(topic: string, maxExperts: number): RankedExpert[] {
    return rankExpertsBySignal({
      agents: dependencies.getAllAgents(),
      topic,
      activeIds: new Set(dependencies.getActiveIds()),
      maxExperts,
    });
  }

  return {
    searchExperts(topic: string, requestedCount = 4): ExpertCandidate[] {
      return rankExperts(topic, requestedCount).map((entry) => toCandidate(entry.agent, entry.score, entry.isActive));
    },
    rankExperts,
    toCandidate,
  };
}
