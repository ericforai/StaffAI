/**
 * Memory Module Index
 *
 * Exports all memory-related functionality including:
 * - Type definitions for the MemoryRetriever interface
 * - FileMemoryRetriever implementation
 * - Legacy memory-retriever functions for backward compatibility
 */

// Type definitions
export type {
  MemoryDocumentType,
  MemoryContext,
  RetrieveOptions,
  RetrievalResult,
  MemoryRetriever,
  MemoryRetrieverConfig,
} from './memory-retriever-types.js';

export {
  MEMORY_DIRECTORY_MAP,
  MEMORY_TYPE_WEIGHTS,
} from './memory-retriever-types.js';

// Implementation
export {
  FileMemoryRetriever,
  createMemoryRetriever,
} from './file-memory-retriever.js';

// Indexer utilities
export {
  indexMemoryDocuments,
  categorizeDocument,
  filterDocumentsByType,
  filterDocumentsByDateRange,
  deduplicateDocuments,
  type MemoryDocument,
  type DocumentCategory,
} from './memory-indexer.js';

// Legacy functions (for backward compatibility)
export {
  retrieveMemoryContext,
  writeExecutionSummaryToMemory,
  clearMemoryCache,
  retrieveForTask,
  retrieveProjectContext,
  retrieveDecisions,
  retrieveAgentContext,
  retrieveKnowledge,
} from './memory-retriever.js';
