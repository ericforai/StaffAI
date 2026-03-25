/**
 * Knowledge Adapter
 *
 * Bridges the legacy JSON-based knowledge storage with the new Markdown
 * memory system. Provides a unified interface for knowledge operations
 * while maintaining backward compatibility.
 *
 * @module legacy/knowledge-adapter
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  JsonKnowledgeEntry,
  KnowledgeAdapterConfig,
  KnowledgeRepository,
  MigrationOptions,
  MigrationResult,
  UnifiedKnowledgeEntry,
} from './knowledge-types';
import {
  DEFAULT_KNOWLEDGE_CONFIG,
  MAX_KNOWLEDGE_ENTRIES,
} from './knowledge-types';
import { calculateKnowledgeScore } from './knowledge-search';
import { createMemoryLayout, type MemoryDirectoryLayout } from '../memory/memory-layout';

/**
 * Generates a unique filename for a knowledge entry
 * Format: YYYY-MM-DD-{agentId}-{hash}.md
 */
function getMarkdownFilename(entry: JsonKnowledgeEntry): string {
  const date = new Date(entry.timestamp ?? Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Create a short hash from the task description for uniqueness
  const hash = crypto
    .createHash('md5')
    .update(entry.task)
    .digest('hex')
    .substring(0, 8);

  // Sanitize agent ID for filename
  const safeAgentId = entry.agentId.replace(/[^a-zA-Z0-9-]/g, '-');

  return `${year}-${month}-${day}-${safeAgentId}-${hash}.md`;
}

/**
 * Formats a knowledge entry as Markdown content
 */
function formatMarkdown(entry: JsonKnowledgeEntry): string {
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
 * Parses a markdown file back into a knowledge entry
 */
function parseMarkdown(content: string, relativePath: string): JsonKnowledgeEntry | null {
  const taskMatch = content.match(/##\s*Task\s*\n([\s\S]+?)(?=\n##|\n>|\Z)/);
  const resultMatch = content.match(/##\s*Result Summary\s*\n([\s\S]+?)(?=\n---|\n##|\Z)/);
  const agentMatch = content.match(/>\s*Agent:\s*([^\n]+)/);
  const timestampMatch = content.match(/timestamp=(\d+)/);

  if (!taskMatch || !resultMatch || !agentMatch) {
    return null;
  }

  return {
    task: taskMatch[1].trim(),
    agentId: agentMatch[1].trim(),
    resultSummary: resultMatch[1].trim(),
    timestamp: timestampMatch ? Number.parseInt(timestampMatch[1], 10) : undefined,
  };
}

/**
 * Infers the knowledge category from task content
 */
function inferCategory(entry: JsonKnowledgeEntry): string {
  const task = entry.task.toLowerCase();
  const agent = entry.agentId.toLowerCase();

  if (agent.includes('frontend') || task.includes('ui') || task.includes('component')) {
    return 'frontend';
  }
  if (agent.includes('backend') || task.includes('api') || task.includes('server')) {
    return 'backend';
  }
  if (agent.includes('design') || task.includes('design') || task.includes('ux')) {
    return 'design';
  }
  if (agent.includes('test') || task.includes('test') || task.includes('qa')) {
    return 'testing';
  }
  if (agent.includes('devops') || task.includes('deploy') || task.includes('ci/cd')) {
    return 'devops';
  }

  return 'general';
}

/**
 * Knowledge Adapter Implementation
 *
 * Provides unified knowledge access across JSON and Markdown storage.
 */
export class KnowledgeAdapter implements KnowledgeRepository {
  private readonly memoryLayout: MemoryDirectoryLayout;
  private readonly jsonKnowledgePath: string;
  private readonly config: KnowledgeAdapterConfig;
  private jsonCache: JsonKnowledgeEntry[] | null = null;
  private markdownCache: UnifiedKnowledgeEntry[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds

  constructor(
    memoryRootDir: string,
    jsonKnowledgePath: string,
    config: Partial<KnowledgeAdapterConfig> = {}
  ) {
    this.memoryLayout = createMemoryLayout(memoryRootDir);
    this.jsonKnowledgePath = jsonKnowledgePath;
    this.config = { ...DEFAULT_KNOWLEDGE_CONFIG, ...config };
    this.ensureDirectories();
  }

  /**
   * Ensures required directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.memoryLayout.memoryRootDir)) {
      fs.mkdirSync(this.memoryLayout.memoryRootDir, { recursive: true });
    }
    if (!fs.existsSync(this.memoryLayout.knowledgeDir)) {
      fs.mkdirSync(this.memoryLayout.knowledgeDir, { recursive: true });
    }
  }

  /**
   * Invalidate the cache
   */
  private invalidateCache(): void {
    this.jsonCache = null;
    this.markdownCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL;
  }

  /**
   * Load JSON knowledge entries from file
   */
  private loadJsonKnowledge(): JsonKnowledgeEntry[] {
    if (this.jsonCache !== null && this.isCacheValid()) {
      return this.jsonCache;
    }

    try {
      if (fs.existsSync(this.jsonKnowledgePath)) {
        const content = fs.readFileSync(this.jsonKnowledgePath, 'utf-8');
        this.jsonCache = JSON.parse(content) as JsonKnowledgeEntry[];
      } else {
        this.jsonCache = [];
      }
    } catch (error) {
      console.error('[KnowledgeAdapter] Failed to load JSON knowledge:', error);
      this.jsonCache = [];
    }

    this.cacheTimestamp = Date.now();
    return this.jsonCache;
  }

  /**
   * Save JSON knowledge entries to file
   */
  private saveJsonKnowledge(entries: JsonKnowledgeEntry[]): void {
    try {
      // Enforce max entries limit
      const trimmed = entries.slice(-MAX_KNOWLEDGE_ENTRIES);
      fs.writeFileSync(this.jsonKnowledgePath, JSON.stringify(trimmed, null, 2), 'utf-8');
      this.jsonCache = trimmed;
      this.cacheTimestamp = Date.now();
    } catch (error) {
      console.error('[KnowledgeAdapter] Failed to save JSON knowledge:', error);
      throw error;
    }
  }

  /**
   * Load Markdown knowledge entries from .ai/knowledge/
   */
  private loadMarkdownKnowledge(): UnifiedKnowledgeEntry[] {
    if (this.markdownCache !== null && this.isCacheValid()) {
      return this.markdownCache;
    }

    const entries: UnifiedKnowledgeEntry[] = [];

    if (!fs.existsSync(this.memoryLayout.knowledgeDir)) {
      this.markdownCache = entries;
      return entries;
    }

    const walkDir = (dir: string, baseDir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          walkDir(fullPath, baseDir);
          continue;
        }

        if (!item.isFile() || !item.name.toLowerCase().endsWith('.md')) {
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relativePath = path.relative(baseDir, fullPath);
          const parsed = parseMarkdown(content, relativePath);

          if (parsed) {
            entries.push({
              ...parsed,
              timestamp: parsed.timestamp ?? Date.now(),
              source: 'markdown',
              relativePath,
            });
          }
        } catch (error) {
          console.error(`[KnowledgeAdapter] Failed to read ${fullPath}:`, error);
        }
      }
    };

    walkDir(this.memoryLayout.knowledgeDir, this.memoryLayout.knowledgeDir);
    this.markdownCache = entries;
    this.cacheTimestamp = Date.now();

    return entries;
  }

  /**
   * Save a knowledge entry to Markdown format
   */
  private async saveToMarkdown(entry: JsonKnowledgeEntry): Promise<void> {
    if (!this.config.enableMarkdownWrites) {
      return;
    }

    try {
      const filename = getMarkdownFilename(entry);
      const category = inferCategory(entry);
      const categoryDir = path.join(this.memoryLayout.knowledgeDir, category);

      // Create category directory if it doesn't exist
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

      const filePath = path.join(categoryDir, filename);
      const content = formatMarkdown(entry);

      fs.writeFileSync(filePath, content, 'utf-8');

      // Invalidate cache after write
      this.invalidateCache();
    } catch (error) {
      console.error('[KnowledgeAdapter] Failed to save Markdown:', error);

      if (!this.config.enableJsonFallback) {
        throw error;
      }
    }
  }

  /**
   * Save a knowledge entry
   * Writes to both Markdown and JSON based on sync mode
   */
  public async save(entry: JsonKnowledgeEntry): Promise<void> {
    const entryWithTimestamp = { ...entry, timestamp: entry.timestamp ?? Date.now() };

    // Always write to JSON for backward compatibility
    const jsonEntries = this.loadJsonKnowledge();
    jsonEntries.push(entryWithTimestamp);

    // Trim to max entries
    if (jsonEntries.length > MAX_KNOWLEDGE_ENTRIES) {
      jsonEntries.splice(0, jsonEntries.length - MAX_KNOWLEDGE_ENTRIES);
    }

    this.saveJsonKnowledge(jsonEntries);

    // Write to Markdown based on sync mode
    if (this.config.syncMode !== 'markdown-only') {
      await this.saveToMarkdown(entryWithTimestamp);
    }
  }

  /**
   * Search knowledge entries by query
   * Returns results from both JSON and Markdown sources, merged and ranked
   */
  public async search(query: string, limit = 3): Promise<UnifiedKnowledgeEntry[]> {
    if (!query) {
      return [];
    }

    // Load entries from both sources
    const jsonEntries = this.loadJsonKnowledge();
    const markdownEntries = this.loadMarkdownKnowledge();

    // Convert JSON entries to unified format
    const unifiedFromJson: UnifiedKnowledgeEntry[] = jsonEntries.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp ?? Date.now(),
      source: 'json' as const,
    }));

    // Combine all entries
    const allEntries = [...unifiedFromJson, ...markdownEntries];

    // Calculate scores and filter
    const scored = allEntries
      .map((entry) => ({
        entry,
        score: calculateKnowledgeScore(entry, query),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Return top N entries
    return scored.slice(0, limit).map((item) => item.entry);
  }

  /**
   * Get all knowledge entries from both sources
   */
  public async getAll(): Promise<UnifiedKnowledgeEntry[]> {
    const jsonEntries = this.loadJsonKnowledge();
    const markdownEntries = this.loadMarkdownKnowledge();

    const unifiedFromJson: UnifiedKnowledgeEntry[] = jsonEntries.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp ?? Date.now(),
      source: 'json' as const,
    }));

    return [...unifiedFromJson, ...markdownEntries];
  }

  /**
   * Migrate JSON entries to Markdown format
   */
  public async migrateToJson(options: MigrationOptions): Promise<MigrationResult> {
    const startTime = Date.now();
    const jsonEntries = this.loadJsonKnowledge();

    // Filter by timestamp if specified
    const entriesToMigrate = options.afterTimestamp
      ? jsonEntries.filter((e) => (e.timestamp ?? 0) > options.afterTimestamp!)
      : jsonEntries;

    let migratedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ index: number; entry: JsonKnowledgeEntry; error: string }> = [];

    // Create memory layout for target directory
    const targetLayout = createMemoryLayout(options.memoryRootDir);

    // Ensure target directories exist
    if (!fs.existsSync(targetLayout.knowledgeDir)) {
      fs.mkdirSync(targetLayout.knowledgeDir, { recursive: true });
    }

    for (let i = 0; i < entriesToMigrate.length; i++) {
      const entry = entriesToMigrate[i];

      // Report progress
      options.onProgress?.(i + 1, entriesToMigrate.length);

      try {
        const filename = getMarkdownFilename(entry);
        const category = inferCategory(entry);
        const categoryDir = path.join(targetLayout.knowledgeDir, category);
        const filePath = path.join(categoryDir, filename);

        // Create category directory if needed
        if (!options.dryRun && !fs.existsSync(categoryDir)) {
          fs.mkdirSync(categoryDir, { recursive: true });
        }

        // Check if file already exists
        if (fs.existsSync(filePath)) {
          skippedCount++;
          continue;
        }

        // Format and write content
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
}

/**
 * Factory function to create a KnowledgeAdapter
 */
export function createKnowledgeAdapter(
  memoryRootDir: string,
  jsonKnowledgePath: string,
  config?: Partial<KnowledgeAdapterConfig>
): KnowledgeAdapter {
  return new KnowledgeAdapter(memoryRootDir, jsonKnowledgePath, config);
}

/**
 * Validates if an object is a valid JsonKnowledgeEntry
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
