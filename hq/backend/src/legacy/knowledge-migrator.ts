/**
 * Knowledge Migrator
 *
 * Utilities for migrating knowledge from the legacy JSON format
 * to the new Markdown-based memory system.
 *
 * @module legacy/knowledge-migrator
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  JsonKnowledgeEntry,
  MigrationOptions,
  MigrationResult,
} from './knowledge-types';

/**
 * Generates a unique filename for a knowledge entry.
 * Format: YYYY-MM-DD-{agentId}-{hash}.md
 *
 * @param entry - The knowledge entry
 * @returns A unique markdown filename
 */
export function getMarkdownFilename(entry: JsonKnowledgeEntry): string {
  const timestamp = entry.timestamp ?? Date.now();
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Create hash from task description for uniqueness
  const hash = crypto
    .createHash('md5')
    .update(entry.task)
    .digest('hex')
    .substring(0, 8);

  // Sanitize agent ID for filename use
  const safeAgentId = entry.agentId.replace(/[^a-zA-Z0-9-]/g, '-');

  return `${year}-${month}-${day}-${safeAgentId}-${hash}.md`;
}

/**
 * Formats a knowledge entry as Markdown content.
 *
 * @param entry - The knowledge entry to format
 * @returns Formatted Markdown content
 */
export function formatMarkdown(entry: JsonKnowledgeEntry): string {
  const timestamp = entry.timestamp ?? Date.now();
  const date = new Date(timestamp).toISOString();

  return `# Knowledge Entry

> Created: ${date}
> Agent: ${entry.agentId}

## Task

${entry.task}

## Result Summary

${entry.resultSummary}

---

*Metadata: timestamp=${timestamp}, agent=${entry.agentId}*
`;
}

/**
 * Infers the knowledge category from task content and agent ID.
 * Used for organizing entries into subdirectories.
 *
 * @param entry - The knowledge entry
 * @returns A category string (frontend, backend, design, testing, devops, general)
 */
export function inferCategory(entry: JsonKnowledgeEntry): string {
  const task = entry.task.toLowerCase();
  const agent = entry.agentId.toLowerCase();

  // Check agent ID first (more reliable)
  if (agent.includes('frontend') || agent.includes('ui') || agent.includes('web')) {
    return 'frontend';
  }
  if (agent.includes('backend') || agent.includes('server') || agent.includes('api')) {
    return 'backend';
  }
  if (agent.includes('design') || agent.includes('ux') || agent.includes('graphic')) {
    return 'design';
  }
  if (agent.includes('test') || agent.includes('qa') || agent.includes('quality')) {
    return 'testing';
  }
  if (agent.includes('devops') || agent.includes('ops') || agent.includes('infra')) {
    return 'devops';
  }

  // Fall back to task content analysis
  if (task.includes('ui') || task.includes('component') || task.includes('frontend')) {
    return 'frontend';
  }
  if (task.includes('api') || task.includes('server') || task.includes('backend')) {
    return 'backend';
  }
  if (task.includes('design') || task.includes('ux') || task.includes('visual')) {
    return 'design';
  }
  if (task.includes('test') || task.includes('qa') || task.includes('spec')) {
    return 'testing';
  }
  if (task.includes('deploy') || task.includes('ci') || task.includes('cd')) {
    return 'devops';
  }

  return 'general';
}

/**
 * Main migration function: converts JSON knowledge to Markdown files.
 *
 * @param options - Migration configuration options
 * @returns Migration result with statistics
 */
export async function migrateKnowledgeToJson(options: MigrationOptions): Promise<MigrationResult> {
  const startTime = Date.now();

  // Load JSON entries
  let jsonEntries: JsonKnowledgeEntry[] = [];
  try {
    if (fs.existsSync(options.jsonKnowledgePath)) {
      const content = fs.readFileSync(options.jsonKnowledgePath, 'utf-8');
      jsonEntries = JSON.parse(content) as JsonKnowledgeEntry[];
    }
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: [
        {
          index: 0,
          entry: { task: '', agentId: '', resultSummary: '' },
          error: error instanceof Error ? error.message : String(error),
        },
      ],
      duration: Date.now() - startTime,
    };
  }

  // Filter by timestamp if specified
  const entriesToMigrate = options.afterTimestamp
    ? jsonEntries.filter((e) => (e.timestamp ?? 0) > options.afterTimestamp!)
    : jsonEntries;

  // Ensure target knowledge directory exists
  const knowledgeDir = path.join(options.memoryRootDir, '.ai', 'knowledge');
  if (!options.dryRun && !fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir, { recursive: true });
  }

  let migratedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ index: number; entry: JsonKnowledgeEntry; error: string }> = [];

  for (let i = 0; i < entriesToMigrate.length; i++) {
    const entry = entriesToMigrate[i];

    // Progress callback
    options.onProgress?.(i + 1, entriesToMigrate.length);

    try {
      const filename = getMarkdownFilename(entry);
      const category = inferCategory(entry);
      const categoryDir = path.join(knowledgeDir, category);
      const filePath = path.join(categoryDir, filename);

      // Create category directory if needed
      if (!options.dryRun && !fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

      // Skip if file already exists
      if (fs.existsSync(filePath)) {
        skippedCount++;
        continue;
      }

      // Write Markdown content
      const content = formatMarkdown(entry);
      if (!options.dryRun) {
        fs.writeFileSync(filePath, content, 'utf-8');
      }

      migratedCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ index: i, entry, error: errorMessage });
    }
  }

  return {
    success: errors.length === 0,
    migratedCount,
    skippedCount,
    errorCount: errors.length,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Validates a knowledge entry has required fields.
 *
 * @param entry - The entry to validate
 * @returns true if valid, false otherwise
 */
export function isValidEntry(entry: unknown): entry is JsonKnowledgeEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const e = entry as Partial<JsonKnowledgeEntry>;
  return (
    typeof e.task === 'string' &&
    e.task.length > 0 &&
    typeof e.agentId === 'string' &&
    e.agentId.length > 0 &&
    typeof e.resultSummary === 'string' &&
    e.resultSummary.length > 0
  );
}

/**
 * Cleans up old JSON entries after successful migration.
 *
 * @param jsonPath - Path to the JSON file
 * @param retainCount - Number of entries to keep (for safety)
 * @returns true if cleanup succeeded
 */
export function cleanupJsonAfterMigration(jsonPath: string, retainCount = 10): boolean {
  try {
    if (!fs.existsSync(jsonPath)) {
      return true;
    }

    const content = fs.readFileSync(jsonPath, 'utf-8');
    const entries = JSON.parse(content) as JsonKnowledgeEntry[];

    // Keep the most recent entries as backup
    const retained = entries.slice(-retainCount);
    fs.writeFileSync(jsonPath, JSON.stringify(retained, null, 2), 'utf-8');

    return true;
  } catch (error) {
    console.error('[KnowledgeMigrator] Cleanup failed:', error);
    return false;
  }
}
