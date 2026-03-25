/**
 * Permission Checker
 * Evaluates access control rules for agents, templates, and memory domains
 */

import type { UserConfig } from './user-types.js';
import type { Agent } from '../types.js';

/**
 * Template interface for permission checking
 */
export interface Template {
  id: string;
  owner?: string;
  department?: string;
  name: string;
}

export interface PermissionChecker {
  canAccessAgent(user: UserConfig, agent: Agent): boolean;
  canAccessTemplate(user: UserConfig, template: Template): boolean;
  canAccessMemoryDomain(user: UserConfig, domain: string): boolean;
  filterAgents(user: UserConfig, agents: Agent[]): Agent[];
  filterTemplates(user: UserConfig, templates: Template[]): Template[];
}

/**
 * Check if user has access to an agent
 */
function canAccessAgent(user: UserConfig, agent: Agent): boolean {
  // Explicit denial takes precedence
  if (user.deniedAgentIds.includes(agent.id)) {
    return false;
  }

  // Explicit allow list
  if (user.allowedAgentIds.length > 0) {
    return user.allowedAgentIds.includes(agent.id);
  }

  // Department filter
  if (user.allowedAgentDepartments.length > 0) {
    return user.allowedAgentDepartments.includes(agent.department);
  }

  // Tag-based filtering (check if agent's name or description contains allowed tags)
  if (user.allowedAgentTags.length > 0) {
    const agentText = `${agent.frontmatter.name} ${agent.frontmatter.description} ${agent.id}`.toLowerCase();
    return user.allowedAgentTags.some((tag) => agentText.includes(tag.toLowerCase()));
  }

  // Default: allow access
  return true;
}

/**
 * Check if user has access to a template
 */
function canAccessTemplate(user: UserConfig, template: Template): boolean {
  switch (user.templateAccess) {
    case 'all':
      return true;
    case 'none':
      return false;
    case 'department':
      return template.department === user.department;
    case 'owned':
      return template.owner === user.id;
    default:
      return true;
  }
}

/**
 * Check if user has access to a memory domain
 */
function canAccessMemoryDomain(user: UserConfig, domain: string): boolean {
  // If allowedDomains is empty, allow all
  if (user.memoryAccess.allowedDomains.length === 0) {
    return true;
  }

  // Check if domain is in allowed list
  return user.memoryAccess.allowedDomains.includes(domain);
}

/**
 * Create a permission checker instance
 */
export function createPermissionChecker(): PermissionChecker {
  return {
    canAccessAgent(user: UserConfig, agent: Agent): boolean {
      return canAccessAgent(user, agent);
    },

    canAccessTemplate(user: UserConfig, template: Template): boolean {
      return canAccessTemplate(user, template);
    },

    canAccessMemoryDomain(user: UserConfig, domain: string): boolean {
      return canAccessMemoryDomain(user, domain);
    },

    filterAgents(user: UserConfig, agents: Agent[]): Agent[] {
      return agents.filter((agent) => canAccessAgent(user, agent));
    },

    filterTemplates(user: UserConfig, templates: Template[]): Template[] {
      return templates.filter((template) => canAccessTemplate(user, template));
    },
  };
}
