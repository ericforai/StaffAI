/**
 * Memory Retriever Type Definitions
 *
 * Defines the complete interface system for memory retrieval across
 * different document types and contexts.
 */

/**
 * Standard memory document types corresponding to .ai/ subdirectories
 */
export type MemoryDocumentType = 'project' | 'task' | 'decision' | 'knowledge' | 'agent';

/**
 * Maps document types to their standard directory paths within .ai/
 */
export const MEMORY_DIRECTORY_MAP: Record<MemoryDocumentType, string> = {
  project: '.ai/context/',
  task: '.ai/tasks/',
  decision: '.ai/decisions/',
  knowledge: '.ai/knowledge/',
  agent: '.ai/agents/',
} as const;

/**
 * Scoring weights for different memory document types.
 * Higher values indicate higher relevance priority in search results.
 */
export const MEMORY_TYPE_WEIGHTS: Record<MemoryDocumentType, number> = {
  project: 1.0,
  task: 1.2,
  decision: 1.5,
  knowledge: 1.3,
  agent: 1.1,
} as const;

/**
 * A single memory context entry with scoring and metadata
 */
export interface MemoryContext {
  /** Relative path from memory root (e.g., "decisions/2024-03-15-architecture.md") */
  relativePath: string;
  /** Type classification of the document */
  type: MemoryDocumentType;
  /** Excerpt of the document content */
  excerpt: string;
  /** Full content if requested, otherwise undefined */
  fullContent?: string;
  /** Computed relevance score (higher = more relevant) */
  score: number;
  /** Last modified timestamp in milliseconds */
  modifiedAtMs: number;
}

/**
 * Options for memory retrieval operations
 */
export interface RetrieveOptions {
  /** Maximum number of results to return (default: 3) */
  limit?: number;
  /** Minimum score threshold for inclusion (default: 0) */
  threshold?: number;
  /** Whether to include full document content (default: false) */
  includeFullContent?: boolean;
  /** Filter to specific document types only (default: all types) */
  documentTypes?: MemoryDocumentType[];
  /** Filter by time range (inclusive) */
  timeRange?: { start: Date; end: Date };
  /** Maximum characters per excerpt (default: 300) */
  excerptMaxChars?: number;
  /** Maximum total characters in context string (default: 1600) */
  contextMaxChars?: number;
  /** Fallback behavior when no matches found (default: 'recent') */
  fallbackMode?: 'none' | 'recent';
}

/**
 * Complete retrieval result with entries, formatted context, and metadata
 */
export interface RetrievalResult {
  /** Ordered list of retrieved context entries */
  entries: MemoryContext[];
  /** Formatted context string suitable for LLM prompting */
  context: string;
  /** Metadata about the retrieval operation */
  metadata: {
    /** The query string used for retrieval */
    query: string;
    /** Total documents scanned */
    totalDocuments: number;
    /** Documents that matched the query */
    matchedDocuments: number;
    /** Breakdown of documents by type */
    types: Record<MemoryDocumentType, number>;
  };
}

/**
 * Main memory retriever interface
 *
 * Implementations provide semantic search and context retrieval
 * across different memory domains.
 */
export interface MemoryRetriever {
  /**
   * Retrieve memory context relevant to a specific task
   * @param query - Search query for relevance matching
   * @param taskId - Task identifier for task-specific memory
   * @param options - Retrieval configuration options
   */
  retrieveForTask(query: string, taskId: string, options?: RetrieveOptions): Promise<RetrievalResult>;

  /**
   * Retrieve general project context
   * @param query - Optional search query for filtering
   * @param options - Retrieval configuration options
   */
  retrieveProjectContext(query?: string, options?: RetrieveOptions): Promise<RetrievalResult>;

  /**
   * Retrieve decision records matching a query
   * @param query - Search query for decision relevance
   * @param options - Retrieval configuration options
   */
  retrieveDecisions(query: string, options?: RetrieveOptions): Promise<RetrievalResult>;

  /**
   * Retrieve agent-specific memory context
   * @param agentId - Agent identifier
   * @param query - Optional search query for filtering
   * @param options - Retrieval configuration options
   */
  retrieveAgentContext(agentId: string, query?: string, options?: RetrieveOptions): Promise<RetrievalResult>;

  /**
   * Retrieve knowledge base entries
   * @param query - Search query for knowledge relevance
   * @param domain - Optional domain filter (e.g., "engineering", "design")
   * @param options - Retrieval configuration options
   */
  retrieveKnowledge(query: string, domain?: string, options?: RetrieveOptions): Promise<RetrievalResult>;

  /**
   * General retrieval across all memory types
   * @param query - Search query for relevance matching
   * @param options - Retrieval configuration options
   */
  retrieve(query: string, options?: RetrieveOptions): Promise<RetrievalResult>;
}

/**
 * Configuration for creating a MemoryRetriever instance
 */
export interface MemoryRetrieverConfig {
  /** Root directory containing .ai/ folder */
  memoryRootDir: string;
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTtlMs?: number;
  /** Whether caching is enabled (default: true) */
  enableCache?: boolean;

  /** Enable vector-based reranking (default: false) */
  enableVectorRerank?: boolean;
  /** Weight for vector score blending (default: 0) */
  vectorWeight?: number;
  /** How many top lexical candidates to rerank (default: max(limit*10, 50)) */
  rerankTopK?: number;

  /** Enable retrieval usage logging (default: false) */
  enableUsageLogs?: boolean;
  /** Path to a JSONL usage log file (default: <memoryRootDir>/usage/retrieval.jsonl) */
  usageLogPath?: string;
}
