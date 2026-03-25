/**
 * User Context Service
 * Main service for user context management and resource filtering
 */

import type { UserContext, UserConfig } from './user-types.js';
import type { Agent } from '../types.js';
import type { UserRepository } from './user-repository.js';
import type { PermissionChecker, Template } from './permission-checker.js';

export interface UserContextService {
  getCurrentUser(userId?: string): UserContext | null;
  filterAgentsByUser(agents: Agent[], userId?: string): Agent[];
  filterTemplatesByUser(templates: Template[], userId?: string): Template[];
  checkAccess(userId: string | undefined, resource: string, action: string): boolean;
}

/**
 * Create a user context service instance
 */
export function createUserContextService(
  userRepository: UserRepository,
  permissionChecker: PermissionChecker
): UserContextService {
  return {
    getCurrentUser(userId?: string): UserContext | null {
      const id = userId || 'user-default';
      const config = userRepository.getUser(id);

      if (!config) {
        return null;
      }

      return {
        id: config.id,
        name: config.name,
        department: config.department,
        clearanceLevel: config.clearanceLevel,
        config,
      };
    },

    filterAgentsByUser(agents: Agent[], userId?: string): Agent[] {
      const id = userId || 'user-default';
      const user = userRepository.getUser(id);

      if (!user) {
        // If no user found, return empty for denyAll, all for allowAll
        const allUsers = userRepository.getAllUsers();
        const policyDenyAll = allUsers.length === 0;
        return policyDenyAll ? [] : agents;
      }

      return permissionChecker.filterAgents(user, agents);
    },

    filterTemplatesByUser(templates: Template[], userId?: string): Template[] {
      const id = userId || 'user-default';
      const user = userRepository.getUser(id);

      if (!user) {
        return [];
      }

      return permissionChecker.filterTemplates(user, templates);
    },

    checkAccess(userId: string | undefined, resource: string, action: string): boolean {
      const id = userId || 'user-default';
      const user = userRepository.getUser(id);

      if (!user) {
        return false;
      }

      // Admin users have full access
      if (user.clearanceLevel === 'admin') {
        return true;
      }

      // Basic users cannot perform destructive actions
      if (user.clearanceLevel === 'basic') {
        const destructiveActions = ['delete', 'remove', 'fire', 'modify'];
        if (destructiveActions.some((da) => action.toLowerCase().includes(da))) {
          return false;
        }
      }

      // Resource-specific checks can be added here
      return true;
    },
  };
}
