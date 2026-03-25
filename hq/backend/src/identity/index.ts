/**
 * Identity Module
 * Exports all user context and permission-related types and services
 */

export type {
  ClearanceLevel,
  MemoryAccessConfig,
  TemplateAccessScope,
  UserConfig,
  UserContext,
  UserPolicy,
} from './user-types.js';

export type { UserRepository } from './user-repository.js';

export type { PermissionChecker, Template } from './permission-checker.js';

export type { UserContextService } from './user-context.js';

export { createUserRepository } from './user-repository.js';

export { createPermissionChecker } from './permission-checker.js';

export { createUserContextService } from './user-context.js';
