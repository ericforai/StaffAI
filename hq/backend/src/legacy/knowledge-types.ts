/**
 * Legacy JSON Knowledge Type Definitions
 *
 * Provides compatibility between the legacy JSON-based knowledge storage
 * and the new Markdown-based memory system in .ai/knowledge/.
 *
 * @module legacy/knowledge-types
 */

/**
 * Legacy JSON knowledge entry format from company_knowledge.json
 * Used by Store.getKnowledge() and Store.saveKnowledge()
 */
export interface JsonKnowledgeEntry {
  /** The original task description */
  task: string;
  /** Agent ID that handled the task */
  agentId: string;
  /** Summary of the result/execution */
  resultSummary: string;
  /** Optional timestamp (defaults to Date.now() in saveKnowledge) */
  timestamp?: number;
}

/**
 * Unified knowledge entry output by the adapter
 * Combines entries from both JSON and Markdown sources
 */
export interface UnifiedKnowledgeEntry {
  /** The original task description */
  task: string;
  /** Agent ID that handled the task */
  agentId: string;
  /** Summary of the result/execution */
  resultSummary: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Source of this entry */
  source: 'json' | 'markdown' | 'postgres';
  /** Relative path for markdown entries, undefined for JSON */
  relativePath?: string;
}

/**
 * Knowledge adapter configuration
 * Controls how knowledge is persisted and retrieved
 */
export interface KnowledgeAdapterConfig {
  /** Enable writing to Markdown (.ai/knowledge/) */
  enableMarkdownWrites: boolean;
  /** Enable fallback to JSON when Markdown fails */
  enableJsonFallback: boolean;
  /** Synchronization mode for dual writes */
  syncMode: 'write-through' | 'write-behind' | 'markdown-only';
}

/**
 * Options for migrating knowledge from JSON to Markdown
 */
export interface MigrationOptions {
  /** Root directory containing .ai/knowledge/ */
  memoryRootDir: string;
  /** Path to the legacy JSON knowledge file */
  jsonKnowledgePath: string;
  /** Only migrate entries after this timestamp */
  afterTimestamp?: number;
  /** Run without actually writing files */
  dryRun?: boolean;
  /** Progress callback for migration status */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
  /** Whether the migration completed successfully */
  success: boolean;
  /** Number of entries successfully migrated */
  migratedCount: number;
  /** Number of entries skipped (already exist) */
  skippedCount: number;
  /** Number of entries that failed to migrate */
  errorCount: number;
  /** Detailed error information */
  errors: Array<{ index: number; entry: JsonKnowledgeEntry; error: string }>;
  /** Duration of the migration in milliseconds */
  duration: number;
}

/**
 * Knowledge repository interface
 * Abstracts the storage backend for knowledge entries
 */
export interface KnowledgeRepository {
  /**
   * Save a knowledge entry
   * @param entry - The entry to save
   */
  save(entry: JsonKnowledgeEntry): Promise<void>;

  /**
   * Search knowledge entries by query
   * @param query - Search query string
   * @param limit - Maximum number of results
   */
  search(query: string, limit?: number): Promise<UnifiedKnowledgeEntry[]>;

  /**
   * Get all knowledge entries
   */
  getAll(): Promise<UnifiedKnowledgeEntry[]>;

  /**
   * Migrate JSON entries to Markdown format
   * @param options - Migration configuration
   */
  migrateToJson(options: MigrationOptions): Promise<MigrationResult>;
}

/**
 * Default configuration for the knowledge adapter
 */
export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeAdapterConfig = {
  enableMarkdownWrites: true,
  enableJsonFallback: true,
  syncMode: 'write-through',
} as const;

/**
 * Default maximum number of knowledge entries
 */
export const MAX_KNOWLEDGE_ENTRIES = 100;
