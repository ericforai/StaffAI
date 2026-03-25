/**
 * User Repository
 * Manages loading and querying user configuration from JSON file
 */

import fs from 'fs';
import path from 'path';
import type { UserConfig, UserPolicy } from './user-types.js';

const DEFAULT_USERS_FILE = path.resolve(process.cwd(), '.ai/users/users.json');
const DEFAULT_POLICY_VERSION = '1.0';

export interface UserRepository {
  getUser(userId: string): UserConfig | null;
  getAllUsers(): UserConfig[];
  isEnabled(userId: string): boolean;
  dispose(): void;
}

function shouldWatchUserPolicy(): boolean {
  if (process.env.AGENCY_WATCH_USER_POLICY === '1') {
    return true;
  }

  if (process.env.AGENCY_WATCH_USER_POLICY === '0') {
    return false;
  }

  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
    return false;
  }

  return process.env.NODE_ENV === 'development';
}

/**
 * Create a default user config for backward compatibility
 */
function createDefaultUser(): UserConfig {
  return {
    id: 'user-default',
    name: 'Default User',
    department: 'general',
    clearanceLevel: 'basic',
    allowedAgentIds: [],
    allowedAgentDepartments: [],
    allowedAgentTags: [],
    deniedAgentIds: [],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };
}

/**
 * Create a default policy when no config file exists
 */
function createDefaultPolicy(): UserPolicy {
  return {
    version: DEFAULT_POLICY_VERSION,
    defaultPolicy: 'allowAll',
    users: [createDefaultUser()],
  };
}

/**
 * Load user policy from file, or return default if not found
 */
function loadPolicy(filePath: string): UserPolicy {
  try {
    if (!fs.existsSync(filePath)) {
      return createDefaultPolicy();
    }

    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const policy = JSON.parse(rawContent) as UserPolicy;

    // Validate structure
    if (!policy.version || !Array.isArray(policy.users)) {
      console.warn(`[UserRepository] Invalid policy format, using default`);
      return createDefaultPolicy();
    }

    return policy;
  } catch (error) {
    console.warn(`[UserRepository] Failed to load policy: ${error}`);
    return createDefaultPolicy();
  }
}

/**
 * Create a user repository instance
 */
export function createUserRepository(filePath?: string): UserRepository {
  const resolvedPath = filePath || DEFAULT_USERS_FILE;
  let policy = loadPolicy(resolvedPath);

  // Watch for file changes in development
  let isWatching = false;
  if (shouldWatchUserPolicy()) {
    isWatching = true;
    fs.watchFile(resolvedPath, { interval: 1000 }, () => {
      policy = loadPolicy(resolvedPath);
    });
  }

  return {
    getUser(userId: string): UserConfig | null {
      // Try to find user by ID
      const user = policy.users.find((u) => u.id === userId && u.enabled);
      if (user) {
        return user;
      }

      // Fallback to default user in allowAll mode
      if (policy.defaultPolicy === 'allowAll') {
        return createDefaultUser();
      }

      return null;
    },

    getAllUsers(): UserConfig[] {
      return policy.users.filter((u) => u.enabled);
    },

    isEnabled(userId: string): boolean {
      const user = policy.users.find((u) => u.id === userId);
      return user?.enabled ?? false;
    },

    dispose(): void {
      // Clean up file watcher to prevent resource leaks
      if (isWatching) {
        fs.unwatchFile(resolvedPath);
        isWatching = false;
      }
    },
  };
}
