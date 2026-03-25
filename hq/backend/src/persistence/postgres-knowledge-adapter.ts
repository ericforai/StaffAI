/**
 * Postgres Knowledge Adapter
 *
 * Implements KnowledgeRepository using PostgreSQL as the backend.
 * Supports keyword search using JSONB and potentially full-text search.
 *
 * @module persistence/postgres-knowledge-adapter
 */

import { Pool, type PoolConfig } from 'pg';
import type {
  JsonKnowledgeEntry,
  KnowledgeRepository,
  MigrationOptions,
  MigrationResult,
  UnifiedKnowledgeEntry,
} from '../legacy/knowledge-types';

/**
 * Feature extraction for keyword-based scoring (identical to legacy adapter for consistency)
 */
function extractFeatures(text: string): Map<string, number> {
  const features = new Map<string, number>();
  const words = text
    .toLowerCase()
    .split(/[\s,，.。!！?？\-_/]+/)
    .filter((t) => t.length > 0);

  for (const word of words) {
    features.set(word, (features.get(word) ?? 0) + 1);
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/[\u4e00-\u9fa5]/.test(char)) {
      features.set(char, (features.get(char) ?? 0) + 1);
    }
  }
  return features;
}

/**
 * Calculates relevance score (identical to legacy adapter for consistency)
 */
function calculateScore(entry: JsonKnowledgeEntry, query: string): number {
  const queryFeatures = extractFeatures(query);
  const taskFeatures = extractFeatures(entry.task);
  const resultFeatures = extractFeatures(entry.resultSummary);
  const agentFeatures = extractFeatures(entry.agentId);

  let score = 0;
  queryFeatures.forEach((count, feature) => {
    if (taskFeatures.has(feature)) score += count * taskFeatures.get(feature)! * 5;
    if (resultFeatures.has(feature)) score += count * resultFeatures.get(feature)! * 3;
    if (agentFeatures.has(feature)) score += count * agentFeatures.get(feature)! * 2;
  });
  return score;
}

export interface PostgresKnowledgeOptions {
  connectionString: string;
  schema?: string;
  tableName?: string;
  poolMax?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  ssl?: PoolConfig['ssl'];
}

export class PostgresKnowledgeAdapter implements KnowledgeRepository {
  private readonly pool: Pool;
  private readonly schema: string;
  private readonly tableName: string;
  private bootstrapPromise: Promise<void> | null = null;

  constructor(options: PostgresKnowledgeOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: options.poolMax,
      idleTimeoutMillis: options.idleTimeoutMs,
      connectionTimeoutMillis: options.connectionTimeoutMs,
      allowExitOnIdle: true,
      ssl: options.ssl,
    });
    this.schema = options.schema || 'public';
    this.tableName = options.tableName || 'knowledge_base';
  }

  private async ensureBootstrapped(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = (async () => {
        const qualifiedTable = `"${this.schema}"."${this.tableName}"`;
        await this.pool.query(
          `CREATE TABLE IF NOT EXISTS ${qualifiedTable} (
            id TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`
        );
        // Index for task and summary search (JSONB indexing)
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS "${this.tableName}_payload_gin_idx" ON ${qualifiedTable} USING GIN (payload)`
        );
      })();
    }
    return this.bootstrapPromise;
  }

  public async save(entry: JsonKnowledgeEntry): Promise<void> {
    await this.ensureBootstrapped();
    const qualifiedTable = `"${this.schema}"."${this.tableName}"`;
    const timestamp = entry.timestamp ?? Date.now();
    const entryWithTimestamp = { ...entry, timestamp };
    
    // We use a hash of the task description as the primary key if no ID is provided,
    // though the interface doesn't strictly have an ID. 
    // For simplicity, we can just use a UUID or similar.
    const id = `knl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await this.pool.query(
      `INSERT INTO ${qualifiedTable} (id, payload, created_at)
       VALUES ($1, $2, $3)`,
      [id, JSON.stringify(entryWithTimestamp), new Date(timestamp).toISOString()]
    );
  }

  /**
   * Search knowledge entries by query
   * Currently uses in-memory scoring over all records (matching legacy behavior)
   * Future optimization: use Postgres full-text search
   */
  public async search(query: string, limit = 3): Promise<UnifiedKnowledgeEntry[]> {
    if (!query) return [];

    const allEntries = await this.getAll();

    const scored = allEntries
      .map((entry) => ({
        entry,
        score: calculateScore(entry, query),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((item) => item.entry);
  }

  public async getAll(): Promise<UnifiedKnowledgeEntry[]> {
    await this.ensureBootstrapped();
    const qualifiedTable = `"${this.schema}"."${this.tableName}"`;
    const result = await this.pool.query(
      `SELECT payload FROM ${qualifiedTable} ORDER BY created_at DESC`
    );

    return result.rows.map((row) => ({
      ...(row.payload as JsonKnowledgeEntry),
      timestamp: (row.payload as JsonKnowledgeEntry).timestamp ?? Date.now(),
      source: 'postgres' as const,
    }));
  }

  /**
   * Migrate entries to Markdown format
   * (Placeholder for interface compatibility)
   */
  public async migrateToJson(_options: MigrationOptions): Promise<MigrationResult> {
    return {
      success: true,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      duration: 0,
    };
  }
}

/**
 * Factory function to create a PostgresKnowledgeAdapter
 */
export function createPostgresKnowledgeAdapter(
  options: PostgresKnowledgeOptions
): PostgresKnowledgeAdapter {
  return new PostgresKnowledgeAdapter(options);
}
