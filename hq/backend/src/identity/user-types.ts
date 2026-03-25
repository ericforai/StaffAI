/**
 * User Context Types for Phase 4.8
 * Defines user identity, permissions, and access control structures
 */

export type ClearanceLevel = 'basic' | 'senior' | 'admin';
export type TemplateAccessScope = 'all' | 'department' | 'owned' | 'none';

export interface MemoryAccessConfig {
  canReadProject: boolean;
  canReadDecisions: boolean;
  allowedDomains: string[];
}

export interface UserConfig {
  id: string;
  name: string;
  department: string;
  clearanceLevel: ClearanceLevel;
  allowedAgentIds: string[];
  allowedAgentDepartments: string[];
  allowedAgentTags: string[];
  deniedAgentIds: string[];
  templateAccess: TemplateAccessScope;
  memoryAccess: MemoryAccessConfig;
  enabled: boolean;
}

export interface UserContext {
  id: string;
  name: string;
  department: string;
  clearanceLevel: ClearanceLevel;
  config: UserConfig;
}

export interface UserPolicy {
  version: string;
  defaultPolicy: 'allowAll' | 'denyAll';
  users: UserConfig[];
}
