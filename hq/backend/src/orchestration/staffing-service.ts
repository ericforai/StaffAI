import type { Agent } from '../types';
import type { ExpertCandidate } from './expert-discovery';

interface StaffingDependencies {
  getAgent: (id: string) => Agent | undefined;
  getActiveIds: () => string[];
  saveActiveIds: (ids: string[]) => void;
}

function toCandidate(agent: Agent): ExpertCandidate {
  return {
    id: agent.id,
    name: agent.frontmatter.name,
    description: agent.frontmatter.description,
    department: agent.department,
    score: 0,
    isActive: true,
  };
}

export function createStaffingService(dependencies: StaffingDependencies) {
  return {
    hireExperts(agentIds: string[]) {
      const uniqueIds = Array.from(new Set(agentIds));
      const activeIds = new Set(dependencies.getActiveIds());
      const nextActiveIds = new Set(activeIds);
      const hired: ExpertCandidate[] = [];
      const alreadyActive: ExpertCandidate[] = [];
      const missing: string[] = [];

      for (const agentId of uniqueIds) {
        const agent = dependencies.getAgent(agentId);
        if (!agent) {
          missing.push(agentId);
          continue;
        }

        const candidate = toCandidate(agent);
        if (activeIds.has(agentId)) {
          alreadyActive.push(candidate);
          continue;
        }

        nextActiveIds.add(agentId);
        hired.push(candidate);
      }

      if (hired.length > 0) {
        dependencies.saveActiveIds(Array.from(nextActiveIds));
      }

      return { hired, alreadyActive, missing };
    },
  };
}
