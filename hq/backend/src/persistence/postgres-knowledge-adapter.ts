/**
 * Postgres Knowledge Adapter
 *
 * Implements KnowledgeRepository using PostgreSQL as the backend.
 * Supports keyword search using JSONB and potentially full-text search.
 *
 * @module persistence/postgres-knowledge-adapter
 */

import { randomUUID } from 'node:crypto';
import { Pool, type PoolConfig } from 'pg';
import type {
  JsonKnowledgeEntry,
  KnowledgeRepository,
  MigrationOptions,
  MigrationResult,
  UnifiedKnowledgeEntry,
} from '../legacy/knowledge-types';
import { calculateKnowledgeScore } from '../legacy/knowledge-search';

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
    this.schema = options.schema ?? 'public';
    this.tableName = options.tableName ?? 'knowledge_base';
  }

  private async ensureBootstrapped(): Promise<void> {
    this.bootstrapPromise ??= (async () => {
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
    return this.bootstrapPromise;
  }

  public async save(entry: JsonKnowledgeEntry): Promise<void> {
    await this.ensureBootstrapped();
    const qualifiedTable = `"${this.schema}"."${this.tableName}"`;
    const timestamp = entry.timestamp ?? Date.now();
    const entryWithTimestamp = { ...entry, timestamp };
    
    const id = `knl_${randomUUID()}`;
    
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
        score: calculateKnowledgeScore(entry, query),
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
