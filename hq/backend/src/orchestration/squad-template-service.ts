/**
 * Squad Template Service
 *
 * Provides pre-configured squad templates and resolves them to available agents.
 * Matches template roles to the best available agents from the active pool.
 */

import type { Agent } from '../types';
import {
  SQUAD_TEMPLATES,
  type SquadMember,
  type SquadTemplate,
  type SquadRole,
} from '../shared/squad-types';

/**
 * Agent info available for squad resolution
 */
export interface AvailableAgent {
  id: string;
  name: string;
  department: string;
  description?: string;
}

/**
 * Resolution result with matched members and any unfilled roles
 */
export interface SquadResolutionResult {
  members: SquadMember[];
  unfilledRoles: Array<{ role: SquadRole; department: string }>;
}

/**
 * Create a squad template service
 */
export function createSquadTemplateService(dependencies: {
  getAgent: (id: string) => Agent | undefined;
}) {
  /**
   * Get a specific template by name
   */
  function getTemplate(name: string): SquadTemplate | undefined {
    return SQUAD_TEMPLATES[name];
  }

  /**
   * List all available templates
   */
  function listTemplates(): SquadTemplate[] {
    return Object.values(SQUAD_TEMPLATES);
  }

  /**
   * Score an agent's match for a role spec
   * Higher score = better match
   */
  function scoreAgentMatch(agent: Agent, roleSpec: { department: string; taskTypes: string[] }): number {
    let score = 0;

    // Department match is most important
    if (agent.department === roleSpec.department) {
      score += 10;
    }

    // Check if agent's capabilities align with task types
    const profile = agent.profile;
    if (profile) {
      const matchingTaskTypes = roleSpec.taskTypes.filter((type) =>
        profile.allowedTaskTypes.includes(type as any)
      );
      score += matchingTaskTypes.length * 2;
    }

    // Description keywords match (secondary signal)
    if (agent.frontmatter.description) {
      const desc = agent.frontmatter.description.toLowerCase();
      roleSpec.taskTypes.forEach((type) => {
        if (desc.includes(type.toLowerCase().replace('_', ' '))) {
          score += 1;
        }
      });
    }

    return score;
  }

  /**
   * Find best matching agent for a role from available pool
   */
  function findBestAgentForRole(
    roleSpec: { role: SquadRole; department: string; taskTypes: string[] },
    availableAgents: AvailableAgent[],
    assignedIds: Set<string>
  ): AvailableAgent | null {
    let bestAgent: AvailableAgent | null = null;
    let bestScore = -1;

    for (const agentInfo of availableAgents) {
      // Skip already assigned agents
      if (assignedIds.has(agentInfo.id)) {
        continue;
      }

      const agent = dependencies.getAgent(agentInfo.id);
      if (!agent) {
        continue;
      }

      const score = scoreAgentMatch(agent, roleSpec);
      if (score > bestScore && score > 0) {
        bestScore = score;
        bestAgent = agentInfo;
      }
    }

    return bestAgent;
  }

  /**
   * Resolve a squad template to actual agents from the available pool
   *
   * For each role in the template, finds the best matching agent from available agents.
   * Returns successfully assigned members and list of any unfilled roles.
   */
  function resolveSquad(
    templateName: string,
    availableAgents: AvailableAgent[]
  ): SquadResolutionResult {
    const template = getTemplate(templateName);
    if (!template) {
      return { members: [], unfilledRoles: [] };
    }

    const members: SquadMember[] = [];
    const unfilledRoles: Array<{ role: SquadRole; department: string }> = [];
    const assignedIds = new Set<string>();

    for (const roleSpec of template.roles) {
      const bestAgent = findBestAgentForRole(roleSpec, availableAgents, assignedIds);

      if (bestAgent) {
        members.push({
          agentId: bestAgent.id,
          agentName: bestAgent.name,
          role: roleSpec.role,
          department: bestAgent.department,
        });
        assignedIds.add(bestAgent.id);
      } else {
        unfilledRoles.push({
          role: roleSpec.role,
          department: roleSpec.department,
        });
      }
    }

    return { members, unfilledRoles };
  }

  return {
    getTemplate,
    listTemplates,
    resolveSquad,
  };
}

export type SquadTemplateService = ReturnType<typeof createSquadTemplateService>;
