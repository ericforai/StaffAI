import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type AccessLevel = 'full' | 'readonly' | 'limited' | 'admin';

export interface UserContext {
  id: string;
  name: string;
  homeDir: string;
  accessLevel: AccessLevel;
  customPermissions?: string[];
}

export function getCurrentUser(): UserContext {
  const homeDir = process.env.HOME || os.homedir();
  const userJsonPath = path.join(homeDir, '.ai', 'user.json');

  if (fs.existsSync(userJsonPath)) {
    try {
      const userContent = fs.readFileSync(userJsonPath, 'utf8');
      const userConfig = JSON.parse(userContent);

      return {
        id: userConfig.id || 'unknown',
        name: userConfig.name || 'Unknown User',
        homeDir,
        accessLevel: validateAccessLevel(userConfig.accessLevel),
        customPermissions: userConfig.customPermissions || [],
      };
    } catch (error) {
      console.warn('Failed to parse user.json, falling back to environment:', error);
    }
  }

  const userId = process.env.USER || process.env.USERNAME || 'anonymous';
  const accessLevel = validateAccessLevel(process.env.AGENT_ACCESS_LEVEL);

  return {
    id: userId,
    name: userId === 'anonymous' ? 'Anonymous User' : userId,
    homeDir,
    accessLevel,
  };
}

function validateAccessLevel(level: string | undefined): AccessLevel {
  const validLevels: AccessLevel[] = ['full', 'readonly', 'limited', 'admin'];

  if (level && validLevels.includes(level as AccessLevel)) {
    return level as AccessLevel;
  }

  return 'full';
}

export function filterAgentsByUser(
  agents: Array<{ id: string; name: string; access?: string; readonly?: boolean; metadata?: { requiredPermission?: string } }>,
  user: UserContext
): Array<{ id: string; name: string; access: string; readonly?: boolean }> {
  if (agents.length === 0) {
    return [];
  }

  if (user.accessLevel === 'full' || user.accessLevel === 'admin') {
    return agents.map((agent) => ({
      ...agent,
      access: agent.access || 'public',
      readonly: user.accessLevel === 'readonly',
    })) as Array<{ id: string; name: string; access: string; readonly?: boolean }>;
  }

  return agents.filter((agent) => {
    const agentAccess = agent.access || 'public';

    if (user.customPermissions && user.customPermissions.includes(agent.id)) {
      return true;
    }

    if (agent.metadata?.requiredPermission) {
      return user.customPermissions?.includes(agent.metadata.requiredPermission);
    }

    switch (user.accessLevel) {
      case 'limited':
        return agentAccess === 'public';
      case 'readonly':
        return agentAccess === 'public' || agentAccess === 'internal';
      default:
        return false;
    }
  }).map((agent) => ({
    id: agent.id,
    name: agent.name,
    access: agent.access || 'public',
    readonly: user.accessLevel === 'readonly',
  }));
}

export function checkAccess(
  user: UserContext,
  resourceLevel: 'public' | 'internal' | 'admin' | string,
  operation?: 'read' | 'write'
): boolean {
  if (user.accessLevel === 'full' || user.accessLevel === 'admin') {
    return true;
  }

  if (operation === 'write' && (user.accessLevel === 'readonly' || user.accessLevel === 'limited')) {
    return false;
  }

  if (user.customPermissions && user.customPermissions.length > 0) {
    if (user.customPermissions.includes(`${resourceLevel}-read`) ||
        user.customPermissions.includes(`${resourceLevel}-write`) ||
        user.customPermissions.includes(resourceLevel)) {
      return true;
    }
  }

  switch (user.accessLevel) {
    case 'limited':
      return resourceLevel === 'public';
    case 'readonly':
      return resourceLevel === 'public' || resourceLevel === 'internal';
    default:
      return false;
  }
}
