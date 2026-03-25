/**
 * Memory Module Index
 *
 * Exports all memory-related functionality including:
 * - Type definitions for the MemoryRetriever interface
 * - FileMemoryRetriever implementation
 * - Legacy memory-retriever functions for backward compatibility
 * - Enhanced write-back service with categorization
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

// Write-back service and types
export type {
  ExecutionOutcome,
  WriteBackCategory,
  WriteBackFrontmatter,
  ExecutionSummaryData,
  DecisionRecordData,
  WriteBackResult,
  WriteBackConfig,
  WriteExecutionSummaryOptions,
  WriteDecisionRecordOptions,
} from './write-back-types.js';

export {
  classifyExecutionOutcome,
  extractSuccessFactors,
  extractIssuesEncountered,
  determineStorageCategory,
  generateExecutionFilename,
  generateDecisionFilename,
  WriteBackService,
  createWriteBackService,
  DEFAULT_WRITE_BACK_CONFIG,
} from './write-back-service.js';

export {
  serializeFrontmatter,
  generateTaskSummaryMarkdown,
  generateDecisionRecordMarkdown,
  generateLegacyTaskSummaryMarkdown,
} from './write-back-templates.js';

// Re-export from memory-layout for convenience
export type { MemoryDirectoryLayout } from './memory-layout.js';
export {
  createMemoryLayout,
  MEMORY_DOCUMENT_TYPES,
  MEMORY_SUBDIRS,
  MEMORY_FILE_NAMES,
  PROJECT_TEMPLATE,
  CURRENT_TASK_TEMPLATE,
  formatTemplate,
  isValidDocumentType,
  getSubdirectoryForType,
  inferDocumentType,
} from './memory-layout.js';
