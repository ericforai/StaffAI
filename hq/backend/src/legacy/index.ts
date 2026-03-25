/**
 * Legacy Module
 *
 * Provides backward compatibility and migration utilities for transitioning
 * from JSON-based storage to the new Markdown-based memory system.
 *
 * @module legacy
 */

// Type definitions
export type {
  JsonKnowledgeEntry,
  UnifiedKnowledgeEntry,
  KnowledgeAdapterConfig,
  MigrationOptions,
  MigrationResult,
  KnowledgeRepository,
} from './knowledge-types';

// Constants
export { DEFAULT_KNOWLEDGE_CONFIG, MAX_KNOWLEDGE_ENTRIES } from './knowledge-types';

// Knowledge adapter
export {
  KnowledgeAdapter,
  createKnowledgeAdapter,
} from './knowledge-adapter';

// Knowledge migrator utilities
export {
  getMarkdownFilename,
  formatMarkdown,
  inferCategory,
  migrateKnowledgeToJson,
  isValidEntry,
  cleanupJsonAfterMigration,
} from './knowledge-migrator';
