/**
 * Memory Layer Types
 *
 * Defines the L1/L2/L3 memory hierarchy for StaffAI's memory system.
 * Each layer represents a different scope and persistence level:
 *
 * - L1: Organization-level public memory (read-only, company-wide)
 * - L2: Project-level shared memory (read/write, project-specific)
 * - L3: Agent-level private experience (read/write, agent-specific)
 *
 * @module shared/memory-layer-types
 */

/**
 * The three memory layers in the hierarchy
 */
export type MemoryLayer = 'L1' | 'L2' | 'L3';

/**
 * A single memory entry that can be loaded from any layer
 */
export interface MemoryEntry {
  /** Which layer this entry came from */
  layer: MemoryLayer;
  /** Relative path within the memory directory */
  relativePath: string;
  /** Content excerpt for prompt injection */
  excerpt: string;
  /** Relevance score (higher = more relevant) */
  score: number;
  /** Last modified timestamp in milliseconds */
  modifiedAtMs: number;
  /** Optional metadata */
  metadata?: {
    documentType?: 'project' | 'task' | 'decision' | 'knowledge' | 'agent';
    tags?: string[];
    author?: string;
  };
}

/**
 * Result of a memory load operation
 */
export interface MemoryLoadResult {
  /** Combined context string formatted for LLM prompting */
  context: string;
  /** Individual entries from all layers */
  entries: MemoryEntry[];
  /** Metadata about the load operation */
  metadata: {
    totalEntries: number;
    entriesByLayer: Partial<Record<MemoryLayer, number>>;
    query?: string;
  };
}

/**
 * Policy for loading memory from different layers
 */
export interface MemoryLoadPolicy {
  /** Which layers to include (default: L1, L2) */
  layers: MemoryLayer[];
  /** Maximum entries per layer (default: 5) */
  maxEntriesPerLayer: number;
  /** Maximum total characters in context (default: 2000) */
  maxContextChars: number;
  /** Whether to include L1 organizational memory (default: true) */
  includeL1?: boolean;
  /** Whether to include L2 project memory (default: true) */
  includeL2?: boolean;
  /** Whether to include L3 agent experience (default: false) */
  includeL3?: boolean;
  /** Optional query for relevance-based retrieval */
  query?: string;
}

/**
 * Result of a memory writeback operation
 */
export interface MemoryWritebackResult {
  /** Whether the writeback succeeded */
  success: boolean;
  /** File path that was written (on success) */
  filePath?: string;
  /** Relative path within memory directory */
  relativePath?: string;
  /** Which layer was written to */
  layer?: MemoryLayer;
  /** Error message (on failure) */
  error?: string;
}

/**
 * Policy for writing execution summaries to memory layers
 */
export interface MemoryWritebackPolicy {
  /** Primary target layer (default: L2) */
  primaryLayer: MemoryLayer;
  /** Whether to also write to agent's L3 experience (default: false) */
  writeToAgentExperience: boolean;
  /** Whether to categorize by success/failure in L2 (default: true) */
  categorizeByOutcome: boolean;
  /** Whether to retain legacy task-summaries format (default: true) */
  retainLegacyFormat: boolean;
}

/**
 * Default load policy: L1 + L2, 5 entries per layer, 2000 char limit
 */
export const DEFAULT_LOAD_POLICY: MemoryLoadPolicy = {
  layers: ['L1', 'L2'],
  maxEntriesPerLayer: 5,
  maxContextChars: 2000,
  includeL1: true,
  includeL2: true,
  includeL3: false,
};

/**
 * Default writeback policy: write to L2 with categorization
 */
export const DEFAULT_WRITEBACK_POLICY: MemoryWritebackPolicy = {
  primaryLayer: 'L2',
  writeToAgentExperience: false,
  categorizeByOutcome: true,
  retainLegacyFormat: true,
};
