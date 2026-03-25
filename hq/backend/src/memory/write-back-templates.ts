/**
 * Write-Back Templates
 *
 * Provides template generation functions for markdown documents with
 * YAML frontmatter. Supports task summaries, decision records, and
 * legacy format for backward compatibility.
 *
 * @module memory/write-back-templates
 */

import type {
  DecisionRecordData,
  ExecutionSummaryData,
  WriteBackFrontmatter,
} from './write-back-types';

/**
 * Serializes an object to YAML frontmatter format.
 * Handles strings, numbers, booleans, arrays, and undefined values.
 * Accepts any object for flexibility with different frontmatter schemas.
 */
export function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${String(item)}`);
        }
      }
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`${key}: ${String(value)}`);
    } else {
      // Escape strings that contain special YAML characters
      const stringValue = String(value);
      // Don't quote ISO date strings (they contain colons but are safe unquoted)
      const isIsoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(stringValue);
      if (!isIsoDate && (stringValue.includes(':') || stringValue.includes('#') || stringValue.includes('\n'))) {
        lines.push(`${key}: "${stringValue.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${stringValue}`);
      }
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Generates a task summary markdown document with frontmatter.
 * Includes task details, execution info, and outcome-specific sections.
 */
export function generateTaskSummaryMarkdown(
  data: ExecutionSummaryData,
  frontmatter: WriteBackFrontmatter
): string {
  const sections: string[] = [];

  // Frontmatter
  sections.push(serializeFrontmatter(frontmatter));
  sections.push('');

  // Title
  sections.push(`# ${data.task.title}`);
  sections.push('');
  sections.push(`> Execution ID: \`${data.execution.id}\``);
  sections.push(`> Task ID: \`${data.task.id}\``);
  sections.push('');

  // Task Description
  sections.push('## Task Description');
  sections.push('');
  sections.push(data.task.description || 'No description provided.');
  sections.push('');

  // Execution Details
  sections.push('## Execution Details');
  sections.push('');
  sections.push(`- **Status**: ${data.execution.status}`);
  sections.push(`- **Executor**: ${data.execution.executor || 'unknown'}`);
  sections.push(`- **Runtime**: ${data.execution.runtimeName || 'default'}`);
  sections.push(`- **Started**: ${data.execution.startedAt ?? data.execution.endedAt ?? 'unknown'}`);
  sections.push(`- **Completed**: ${data.execution.completedAt || data.execution.endedAt || 'unknown'}`);

  if (data.execution.retryCount && data.execution.retryCount > 0) {
    sections.push(`- **Retries**: ${data.execution.retryCount}`);
  }

  if (data.execution.degraded) {
    sections.push(`- **Mode**: Degraded`);
  }

  sections.push('');

  // Outcome-specific sections
  if (data.outcome === 'success' || data.outcome === 'partial') {
    if (data.successFactors && data.successFactors.length > 0) {
      sections.push('## Success Factors');
      sections.push('');
      for (const factor of data.successFactors) {
        sections.push(`- ${factor}`);
      }
      sections.push('');
    }
  }

  if (data.issuesEncountered && data.issuesEncountered.length > 0) {
    sections.push('## Issues Encountered');
    sections.push('');
    for (const issue of data.issuesEncountered) {
      sections.push(`- ${issue}`);
    }
    sections.push('');
  }

  // Result Summary
  sections.push('## Result Summary');
  sections.push('');
  const resultSummary = data.execution.outputSummary || data.execution.errorMessage || 'No summary available.';
  sections.push(resultSummary);
  sections.push('');

  // Lessons Learned
  if (data.lessonsLearned && data.lessonsLearned.length > 0) {
    sections.push('## Lessons Learned');
    sections.push('');
    for (const lesson of data.lessonsLearned) {
      sections.push(`- ${lesson}`);
    }
    sections.push('');
  }

  // Metadata
  sections.push('---');
  sections.push('');
  sections.push(`*Generated: ${new Date().toISOString()}*`);
  sections.push(`*Task Type: ${data.task.taskType}*`);
  sections.push(`*Priority: ${data.task.priority}*`);

  return sections.join('\n');
}

/**
 * Generates a decision record markdown document with frontmatter.
 * Documents important technical or product decisions.
 */
export function generateDecisionRecordMarkdown(data: DecisionRecordData): string {
  const sections: string[] = [];

  // Frontmatter
  const frontmatter: WriteBackFrontmatter = {
    id: data.decisionId,
    type: 'decision',
    taskId: data.taskId,
    status: 'recorded',
    startedAt: data.timestamp,
    completedAt: data.timestamp,
    tags: data.tags,
  };
  sections.push(serializeFrontmatter(frontmatter));
  sections.push('');

  // Title
  sections.push(`# ${data.title}`);
  sections.push('');
  sections.push(`> Decision ID: \`${data.decisionId}\``);
  if (data.taskId) {
    sections.push(`> Related Task: \`${data.taskId}\``);
  }
  sections.push('');

  // Context
  sections.push('## Context');
  sections.push('');
  sections.push(data.context);
  sections.push('');

  // Decision
  sections.push('## Decision');
  sections.push('');
  sections.push(data.decision);
  sections.push('');

  // Rationale
  sections.push('## Rationale');
  sections.push('');
  sections.push(data.rationale);
  sections.push('');

  // Impact
  sections.push('## Impact');
  sections.push('');
  sections.push(data.impact);
  sections.push('');

  // Alternatives
  if (data.alternatives && data.alternatives.length > 0) {
    sections.push('## Alternatives Considered');
    sections.push('');
    for (const alternative of data.alternatives) {
      sections.push(`- ${alternative}`);
    }
    sections.push('');
  }

  // Metadata
  sections.push('---');
  sections.push('');
  sections.push(`*Recorded: ${data.timestamp}*`);

  return sections.join('\n');
}

/**
 * Generates a legacy-style task summary (flat format without frontmatter).
 * Used when retainLegacyTaskSummaries is enabled for backward compatibility.
 */
export function generateLegacyTaskSummaryMarkdown(data: ExecutionSummaryData): string {
  const lines: string[] = [];

  lines.push(`## Execution ${data.execution.id}`);
  lines.push('');
  lines.push(`- Time: ${new Date().toISOString()}`);
  lines.push(`- Task: ${data.task.title}`);
  lines.push(`- Task ID: ${data.task.id}`);
  lines.push(`- Mode: ${data.task.executionMode}`);
  lines.push(`- Executor: ${data.execution.executor || 'unknown'}`);
  lines.push(`- Status: ${data.execution.status}`);
  lines.push('');
  lines.push('### Task Description');
  lines.push('');
  lines.push(data.task.description || 'No description provided.');
  lines.push('');
  lines.push('### Result Summary');
  lines.push('');
  const resultSummary = data.execution.outputSummary || data.execution.errorMessage || 'No summary captured.';
  lines.push(resultSummary);
  lines.push('');

  // Add outcome info if available
  if (data.outcome === 'success' && data.successFactors && data.successFactors.length > 0) {
    lines.push('### Success Factors');
    lines.push('');
    for (const factor of data.successFactors) {
      lines.push(`- ${factor}`);
    }
    lines.push('');
  }

  if ((data.outcome === 'failure' || data.outcome === 'partial') && data.issuesEncountered && data.issuesEncountered.length > 0) {
    lines.push('### Issues Encountered');
    lines.push('');
    for (const issue of data.issuesEncountered) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  if (data.lessonsLearned && data.lessonsLearned.length > 0) {
    lines.push('### Lessons Learned');
    lines.push('');
    for (const lesson of data.lessonsLearned) {
      lines.push(`- ${lesson}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
