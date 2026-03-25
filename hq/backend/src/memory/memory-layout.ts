/**
 * Memory Directory Layout
 *
 * Defines the structure and types for the .ai/ memory directory.
 * This provides type-safe constants and helpers for working with the
 * standardized memory layout.
 *
 * @module memory/memory-layout
 */

import path from 'node:path';

/**
 * Supported document types in the memory system.
 * These correspond to subdirectories within the .ai/ directory.
 */
export const MEMORY_DOCUMENT_TYPES = [
  'PROJECT',
  'TASK',
  'DECISION',
  'KNOWLEDGE',
  'AGENT',
  'SHARED',
] as const;

/**
 * Union type of all supported memory document types.
 */
export type MemoryDocumentType = (typeof MEMORY_DOCUMENT_TYPES)[number];

/**
 * Directory structure for the .ai/ memory layout.
 * Provides absolute paths to all memory subdirectories.
 */
export interface MemoryDirectoryLayout {
  /** Root .ai/ directory */
  memoryRootDir: string;
  /** Project context directory */
  contextDir: string;
  /** Task-specific directory */
  tasksDir: string;
  /** Decision records directory */
  decisionsDir: string;
  /** Knowledge base directory */
  knowledgeDir: string;
  /** Knowledge successes subdirectory (for categorized outcomes) */
  knowledgeSuccessesDir: string;
  /** Knowledge failures subdirectory (for categorized outcomes) */
  knowledgeFailuresDir: string;
  /** Agent-specific memory directory */
  agentsDir: string;
  /** Task summaries directory (legacy format) */
  taskSummariesDir: string;
}

/**
 * Template content for project.md in the context directory.
 */
export const PROJECT_TEMPLATE = `# Project Context

> Last updated: {{date}}

## Project Overview
<!-- Brief description of the project -->

## Tech Stack
<!-- Key technologies and frameworks -->

## Architecture
<!-- High-level architecture notes -->

## Current Status
<!-- What's currently being worked on -->

## Key Decisions
<!-- Link to important decisions in /decisions -->

## Known Issues
<!-- Track ongoing issues or blockers -->
`;

/**
 * Template content for current-task.md in the context directory.
 */
export const CURRENT_TASK_TEMPLATE = `# Current Task

> Started: {{date}}

## Task Description
<!-- What you're working on right now -->

## Goal
<!-- What success looks like -->

## Progress
<!-- Current status and next steps -->

## blockers
<!-- Anything preventing progress -->

## Related
<!-- Links to related docs, tasks, or decisions -->
`;

/**
 * Standard subdirectories that should exist in the .ai/ directory.
 */
export const MEMORY_SUBDIRS = [
  'context',
  'tasks',
  'decisions',
  'knowledge',
  'knowledge/successes',
  'knowledge/failures',
  'agents',
  'task-summaries',
] as const;

/**
 * Standard file names for special files in the .ai/ directory.
 */
export const MEMORY_FILE_NAMES = {
  /** Project context file in context/ */
  PROJECT_CONTEXT: 'project.md',
  /** Current task tracker file in context/ */
  CURRENT_TASK: 'current-task.md',
} as const;

/**
 * Creates a MemoryDirectoryLayout object with absolute paths.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns Object containing all directory paths
 *
 * @example
 * ```ts
 * const layout = createMemoryLayout('/path/to/.ai');
 * console.log(layout.contextDir); // '/path/to/.ai/context'
 * ```
 */
export function createMemoryLayout(memoryRootDir: string): MemoryDirectoryLayout {
  return {
    memoryRootDir,
    contextDir: path.join(memoryRootDir, 'context'),
    tasksDir: path.join(memoryRootDir, 'tasks'),
    decisionsDir: path.join(memoryRootDir, 'decisions'),
    knowledgeDir: path.join(memoryRootDir, 'knowledge'),
    knowledgeSuccessesDir: path.join(memoryRootDir, 'knowledge', 'successes'),
    knowledgeFailuresDir: path.join(memoryRootDir, 'knowledge', 'failures'),
    agentsDir: path.join(memoryRootDir, 'agents'),
    taskSummariesDir: path.join(memoryRootDir, 'task-summaries'),
  };
}

/**
 * Infers the document type from a relative path within .ai/.
 *
 * @param relativePath - Path relative to .ai/ root (e.g., 'tasks/task-123.md')
 * @returns The inferred document type, or null if unable to determine
 *
 * @example
 * ```ts
 * inferDocumentType('tasks/task-123.md');      // 'TASK'
 * inferDocumentType('decisions/arch.md');      // 'DECISION'
 * inferDocumentType('context/project.md');     // 'PROJECT'
 * inferDocumentType('agents/seo-specialist.md');// 'AGENT'
 * ```
 */
export function inferDocumentType(relativePath: string): MemoryDocumentType | null {
  const normalizedPath = relativePath.toLowerCase().replace(/\\/g, '/');

  // Project context files
  if (normalizedPath === 'context/project.md' || normalizedPath.startsWith('context/')) {
    return 'PROJECT';
  }

  // Task files
  if (normalizedPath.startsWith('tasks/') || normalizedPath.includes('/tasks/')) {
    return 'TASK';
  }

  // Decision records
  if (normalizedPath.startsWith('decisions/') || normalizedPath.includes('/decisions/')) {
    return 'DECISION';
  }

  // Knowledge base
  if (normalizedPath.startsWith('knowledge/') || normalizedPath.includes('/knowledge/')) {
    return 'KNOWLEDGE';
  }

  // Agent-specific memory
  if (normalizedPath.startsWith('agents/') || normalizedPath.includes('/agents/')) {
    return 'AGENT';
  }

  // Task summaries (shared across system)
  if (normalizedPath.startsWith('task-summaries/') || normalizedPath.includes('/task-summaries/')) {
    return 'SHARED';
  }

  return null;
}

/**
 * Formats a template string by replacing placeholder values.
 *
 * Supported placeholders:
 * - {{date}} - Current date in ISO format
 * - {{year}} - Current year
 * - {{month}} - Current month
 * - {{day}} - Current day
 *
 * @param template - Template string with placeholders
 * @param date - Date to use for replacements (defaults to now)
 * @returns Formatted template string
 *
 * @example
 * ```ts
 * formatTemplate('{{date}}: Some content');
 * // Returns: '2026-03-25: Some content'
 * ```
 */
export function formatTemplate(template: string, date: Date = new Date()): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const isoDate = `${year}-${month}-${day}`;

  return template
    .replace(/\{\{date\}\}/g, isoDate)
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{month\}\}/g, month)
    .replace(/\{\{day\}\}/g, day);
}

/**
 * Validates if a string is a valid MemoryDocumentType.
 *
 * @param value - String to validate
 * @returns true if the value is a valid document type
 */
export function isValidDocumentType(value: string): value is MemoryDocumentType {
  return MEMORY_DOCUMENT_TYPES.includes(value as MemoryDocumentType);
}

/**
 * Gets the subdirectory name for a given document type.
 *
 * @param documentType - The document type
 * @returns The subdirectory name for that type
 */
export function getSubdirectoryForType(documentType: MemoryDocumentType): string {
  switch (documentType) {
    case 'PROJECT':
      return 'context';
    case 'TASK':
      return 'tasks';
    case 'DECISION':
      return 'decisions';
    case 'KNOWLEDGE':
      return 'knowledge';
    case 'AGENT':
      return 'agents';
    case 'SHARED':
      return 'task-summaries';
  }
}
