/**
 * Write-Back Types
 *
 * Defines the core types for the enhanced write-back system that supports:
 * - Categorized execution summaries (successes/failures)
 * - Decision records
 * - Legacy task summaries (backward compatibility)
 *
 * @module memory/write-back-types
 */

import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';

/**
 * Possible outcomes of an execution attempt.
 * Used to categorize summaries for better retrieval.
 */
export type ExecutionOutcome = 'success' | 'failure' | 'partial' | 'degraded';

/**
 * Storage categories for write-back documents.
 * Maps to subdirectories within the memory knowledge base.
 */
export type WriteBackCategory = 'task-summaries' | 'successes' | 'failures' | 'decisions';

/**
 * Frontmatter metadata for write-back markdown files.
 * Provides structured, searchable metadata at the top of each document.
 */
export interface WriteBackFrontmatter {
  /** Unique identifier for the document */
  id: string;
  /** Document type for classification */
  type: 'task-summary' | 'decision' | 'success' | 'failure';
  /** Associated execution ID (if applicable) */
  executionId?: string;
  /** Associated task ID (if applicable) */
  taskId?: string;
  /** Agent that performed the work (if applicable) */
  agentId?: string;
  /** Outcome status for executions */
  outcome?: ExecutionOutcome;
  /** Current status of the associated work */
  status: string;
  /** ISO timestamp when work started */
  startedAt: string;
  /** ISO timestamp when work completed */
  completedAt: string;
  /** Duration in milliseconds (optional) */
  duration?: number;
  /** Optional tags for searchability */
  tags?: string[];
  /** Additional metadata properties */
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Data for generating an execution summary markdown document.
 */
export interface ExecutionSummaryData {
  /** The task that was executed */
  task: TaskRecord;
  /** The execution lifecycle record */
  execution: ExecutionLifecycleRecord;
  /** Classified outcome of the execution */
  outcome: ExecutionOutcome;
  /** Factors that contributed to success (for success outcomes) */
  successFactors?: string[];
  /** Issues encountered during execution (for failure/partial outcomes) */
  issuesEncountered?: string[];
  /** Lessons learned from the execution */
  lessonsLearned?: string[];
}

/**
 * Data for generating a decision record markdown document.
 */
export interface DecisionRecordData {
  /** Unique identifier for the decision */
  decisionId: string;
  /** Short title for the decision */
  title: string;
  /** Context leading to the decision */
  context: string;
  /** The decision that was made */
  decision: string;
  /** Rationale explaining why this decision was made */
  rationale: string;
  /** Expected or actual impact of the decision */
  impact: string;
  /** Alternative options that were considered */
  alternatives?: string[];
  /** Associated task ID (if applicable) */
  taskId?: string;
  /** ISO timestamp when the decision was recorded */
  timestamp: string;
  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Result of a write-back operation.
 */
export interface WriteBackResult {
  /** Whether the write operation succeeded */
  success: boolean;
  /** Absolute path to the written file */
  filePath?: string;
  /** Path relative to memory root directory */
  relativePath?: string;
  /** Category where the document was stored */
  category: WriteBackCategory;
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Configuration for the WriteBackService.
 */
export interface WriteBackConfig {
  /** Root directory for memory storage */
  memoryRootDir: string;
  /** Enable success/failure categorization (vs. flat task-summaries) */
  enableSuccessFailureCategorization: boolean;
  /** Enable separate decision records storage */
  enableDecisionRecords: boolean;
  /** Retain legacy task summaries format for compatibility */
  retainLegacyTaskSummaries: boolean;
  /** Format for markdown frontmatter */
  markdownTemplateFormat: 'frontmatter' | 'inline';
}

/**
 * Options for writing execution summaries.
 */
export interface WriteExecutionSummaryOptions extends Partial<WriteBackConfig> {
  /** Override the automatic outcome classification */
  overrideOutcome?: ExecutionOutcome;
  /** Additional metadata to include in frontmatter */
  additionalMetadata?: Record<string, string | number | boolean | string[] | undefined>;
  /** Custom timestamp for the write (defaults to now) */
  now?: Date;
}

/**
 * Options for writing decision records.
 */
export interface WriteDecisionRecordOptions extends Partial<WriteBackConfig> {
  /** Custom timestamp for the write (defaults to now) */
  now?: Date;
}
