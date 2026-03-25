/**
 * Write-Back Service
 *
 * Enhanced service for writing execution summaries and decision records
 * to the memory system. Supports categorized storage (successes/failures),
 * decision records, and backward-compatible legacy summaries.
 *
 * @module memory/write-back-service
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';
import { createMemoryLayout, type MemoryDirectoryLayout } from './memory-layout';
import {
  generateDecisionRecordMarkdown,
  generateLegacyTaskSummaryMarkdown,
  generateTaskSummaryMarkdown,
  serializeFrontmatter,
} from './write-back-templates';
import type {
  DecisionRecordData,
  ExecutionOutcome,
  ExecutionSummaryData,
  WriteBackCategory,
  WriteBackConfig,
  WriteBackFrontmatter,
  WriteBackResult,
  WriteDecisionRecordOptions,
  WriteExecutionSummaryOptions,
} from './write-back-types';

/**
 * Default write-back configuration.
 */
export const DEFAULT_WRITE_BACK_CONFIG: WriteBackConfig = {
  memoryRootDir: process.env.AGENCY_MEMORY_DIR || path.resolve(process.cwd(), '.ai'),
  enableSuccessFailureCategorization: true,
  enableDecisionRecords: true,
  retainLegacyTaskSummaries: true,
  markdownTemplateFormat: 'frontmatter',
};

/**
 * Classifies an execution's outcome based on its status and properties.
 */
export function classifyExecutionOutcome(execution: ExecutionLifecycleRecord): ExecutionOutcome {
  // Explicit degraded status
  if (execution.degraded || execution.status === 'degraded') {
    return 'degraded';
  }

  // Failed execution
  if (execution.status === 'failed') {
    return 'failure';
  }

  // Completed with error message suggests partial success
  if (execution.status === 'completed' && execution.errorMessage) {
    return 'partial';
  }

  // Clean success
  if (execution.status === 'completed') {
    return 'success';
  }

  // Default to failure for unknown statuses
  return 'failure';
}

/**
 * Extracts success factors from an execution summary.
 * Analyzes the output for positive indicators.
 */
export function extractSuccessFactors(execution: ExecutionLifecycleRecord): string[] {
  const factors: string[] = [];
  const summary = execution.outputSummary || '';

  // Look for success indicators
  const successPatterns = [
    /completed successfully/i,
    /all tests passed/i,
    /build successful/i,
    /deployment successful/i,
    /verified|validated/i,
  ];

  for (const pattern of successPatterns) {
    if (pattern.test(summary)) {
      factors.push(`Positive outcome detected: ${pattern.source.replace(/\\/g, '')}`);
    }
  }

  // If execution completed without retries, note reliability
  if (execution.status === 'completed' && (execution.retryCount ?? 0) === 0) {
    factors.push('Completed on first attempt (no retries)');
  }

  // If not degraded, note full capability
  if (!execution.degraded) {
    factors.push('Full capability execution (not degraded)');
  }

  // Add factors based on executor
  if (execution.executor) {
    factors.push(`Executed via ${execution.executor}`);
  }

  return factors;
}

/**
 * Extracts issues encountered from an execution record.
 */
export function extractIssuesEncountered(execution: ExecutionLifecycleRecord): string[] {
  const issues: string[] = [];

  if (execution.errorMessage) {
    issues.push(`Error: ${execution.errorMessage}`);
  }

  if (execution.structuredError) {
    const { code, message, retriable } = execution.structuredError;
    issues.push(`Structured error [${code}]: ${message}`);
    if (retriable) {
      issues.push('Error was retriable');
    }
  }

  if (execution.retryCount && execution.retryCount > 0) {
    issues.push(`Required ${execution.retryCount} retry attempts`);
  }

  if (execution.degraded) {
    issues.push('Execution ran in degraded mode');
  }

  if (execution.status === 'failed') {
    issues.push('Execution ultimately failed');
  }

  return issues;
}

/**
 * Determines the storage category based on outcome and configuration.
 */
export function determineStorageCategory(
  outcome: ExecutionOutcome,
  config: WriteBackConfig
): WriteBackCategory {
  if (!config.enableSuccessFailureCategorization) {
    return 'task-summaries';
  }

  switch (outcome) {
    case 'success':
      return 'successes';
    case 'failure':
      return 'failures';
    case 'partial':
      return 'failures'; // Partial goes to failures for visibility
    case 'degraded':
      return 'failures'; // Degraded goes to failures for attention
    default:
      return 'task-summaries';
  }
}

/**
 * Generates a filename for an execution summary document.
 */
export function generateExecutionFilename(
  task: TaskRecord,
  execution: ExecutionLifecycleRecord,
  outcome: ExecutionOutcome
): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const safeTitle = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const outcomePrefix = outcome === 'success' ? 'success' : 'failure';

  return `${datePart}-${outcomePrefix}-${task.id}-${safeTitle}.md`;
}

/**
 * Generates a filename for a decision record document.
 */
export function generateDecisionFilename(decisionId: string, title: string): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  return `${datePart}-decision-${decisionId}-${safeTitle}.md`;
}

/**
 * Calculates duration in milliseconds from timestamps.
 */
function calculateDuration(execution: ExecutionLifecycleRecord): number | undefined {
  if (execution.startedAt && (execution.completedAt || execution.endedAt)) {
    const started = new Date(execution.startedAt).getTime();
    const ended = new Date(execution.completedAt || execution.endedAt || '').getTime();
    return ended - started;
  }
  return undefined;
}

/**
 * Generates tags for an execution summary.
 */
function generateExecutionTags(
  task: TaskRecord,
  execution: ExecutionLifecycleRecord,
  outcome: ExecutionOutcome
): string[] {
  const tags: string[] = [];

  tags.push(task.taskType);
  tags.push(task.priority);
  tags.push(outcome);
  tags.push(execution.executor || 'unknown');

  if (execution.degraded) {
    tags.push('degraded');
  }

  if (task.approvalRequired) {
    tags.push('approval-required');
  }

  if (execution.status === 'degraded') {
    tags.push('degraded-mode');
  }

  return tags;
}

/**
 * Service for writing execution summaries and decision records to memory.
 */
export class WriteBackService {
  private readonly config: WriteBackConfig;
  private readonly layout: MemoryDirectoryLayout;

  constructor(config?: Partial<WriteBackConfig>) {
    this.config = { ...DEFAULT_WRITE_BACK_CONFIG, ...config };
    this.layout = createMemoryLayout(this.config.memoryRootDir);
  }

  /**
   * Gets the current configuration.
   */
  public getConfig(): WriteBackConfig {
    return { ...this.config };
  }

  /**
   * Gets the memory directory layout.
   */
  public getMemoryLayout(): MemoryDirectoryLayout {
    return this.layout;
  }

  /**
   * Writes an execution summary to memory with categorization.
   */
  public writeExecutionSummary(
    task: TaskRecord,
    execution: ExecutionLifecycleRecord,
    options?: WriteExecutionSummaryOptions
  ): WriteBackResult {
    try {
      const effectiveConfig = { ...this.config, ...options };
      const outcome = options?.overrideOutcome || classifyExecutionOutcome(execution);
      const category = determineStorageCategory(outcome, effectiveConfig);

      // Build summary data
      const summaryData: ExecutionSummaryData = {
        task,
        execution,
        outcome,
        successFactors: extractSuccessFactors(execution),
        issuesEncountered: extractIssuesEncountered(execution),
        lessonsLearned: [],
      };

      // Determine storage directory
      let targetDir: string;
      let relativePath: string;

      if (effectiveConfig.enableSuccessFailureCategorization) {
        if (outcome === 'success') {
          targetDir = path.join(this.layout.knowledgeDir, 'successes');
          relativePath = `knowledge/successes`;
        } else {
          targetDir = path.join(this.layout.knowledgeDir, 'failures');
          relativePath = `knowledge/failures`;
        }
      } else {
        targetDir = this.layout.taskSummariesDir;
        relativePath = 'task-summaries';
      }

      // Ensure directory exists
      fs.mkdirSync(targetDir, { recursive: true });

      // Generate filename and content
      const filename = generateExecutionFilename(task, execution, outcome);
      const filePath = path.join(targetDir, filename);
      const duration = calculateDuration(execution);
      const tags = generateExecutionTags(task, execution, outcome);

      // Build frontmatter
      const frontmatter: WriteBackFrontmatter = {
        id: execution.id,
        type: outcome === 'success' ? ('success' as const) : ('failure' as const),
        executionId: execution.id,
        taskId: task.id,
        agentId: execution.executor,
        outcome,
        status: execution.status,
        startedAt: execution.startedAt || new Date().toISOString(),
        completedAt: execution.completedAt || execution.endedAt || new Date().toISOString(),
        duration,
        tags,
      };

      const content = generateTaskSummaryMarkdown(summaryData, frontmatter);

      // Write file
      fs.writeFileSync(filePath, content, 'utf8');

      // Write legacy format if enabled
      if (effectiveConfig.retainLegacyTaskSummaries) {
        const legacyDir = this.layout.taskSummariesDir;
        fs.mkdirSync(legacyDir, { recursive: true });

        const legacyFilename = `${new Date().toISOString().slice(0, 10)}-${task.id}.md`;
        const legacyFilePath = path.join(legacyDir, legacyFilename);
        const legacyContent = generateLegacyTaskSummaryMarkdown(summaryData);

        fs.appendFileSync(legacyFilePath, legacyContent, 'utf8');
      }

      return {
        success: true,
        filePath,
        relativePath: path.join(relativePath, filename),
        category,
      };
    } catch (error) {
      return {
        success: false,
        category: 'task-summaries',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Writes a decision record to memory.
   */
  public writeDecisionRecord(
    data: DecisionRecordData,
    options?: WriteDecisionRecordOptions
  ): WriteBackResult {
    try {
      if (!this.config.enableDecisionRecords) {
        return {
          success: false,
          category: 'decisions',
          error: 'Decision records are not enabled in configuration',
        };
      }

      const decisionsDir = this.layout.decisionsDir;
      fs.mkdirSync(decisionsDir, { recursive: true });

      const filename = generateDecisionFilename(data.decisionId, data.title);
      const filePath = path.join(decisionsDir, filename);
      const content = generateDecisionRecordMarkdown(data);

      fs.writeFileSync(filePath, content, 'utf8');

      return {
        success: true,
        filePath,
        relativePath: path.join('decisions', filename),
        category: 'decisions',
      };
    } catch (error) {
      return {
        success: false,
        category: 'decisions',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Checks if a directory path exists and creates it if not.
   */
  public ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Gets all success summary files.
   */
  public getSuccessSummaries(): string[] {
    const successesDir = path.join(this.layout.knowledgeDir, 'successes');
    if (!fs.existsSync(successesDir)) {
      return [];
    }
    return fs.readdirSync(successesDir).filter((f) => f.endsWith('.md'));
  }

  /**
   * Gets all failure summary files.
   */
  public getFailureSummaries(): string[] {
    const failuresDir = path.join(this.layout.knowledgeDir, 'failures');
    if (!fs.existsSync(failuresDir)) {
      return [];
    }
    return fs.readdirSync(failuresDir).filter((f) => f.endsWith('.md'));
  }

  /**
   * Gets all decision record files.
   */
  public getDecisionRecords(): string[] {
    if (!fs.existsSync(this.layout.decisionsDir)) {
      return [];
    }
    return fs.readdirSync(this.layout.decisionsDir).filter((f) => f.endsWith('.md'));
  }
}

/**
 * Creates a WriteBackService instance with default or custom configuration.
 */
export function createWriteBackService(config?: Partial<WriteBackConfig>): WriteBackService {
  return new WriteBackService(config);
}
