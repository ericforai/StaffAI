/**
 * Audit Log Repository Implementations
 *
 * File-based storage for audit logs with date-based partitioning.
 * All file operations are async to prevent blocking the event loop.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type { AuditLogEntry, AuditEntityType } from '../governance/audit-logger';

/**
 * Repository interface for audit log storage
 */
export interface AuditLogRepository {
  save(entry: AuditLogEntry): Promise<void>;
  getById(id: string): Promise<AuditLogEntry | null>;
  getByEntityId(entityId: string): Promise<AuditLogEntry[]>;
  getByEntityType(entityType: AuditEntityType): Promise<AuditLogEntry[]>;
  getByActor(actor: string): Promise<AuditLogEntry[]>;
  getByTimeRange(start: string, end: string): Promise<AuditLogEntry[]>;
}

/**
 * Sort helper for audit logs (newest first)
 */
function sortAuditLogsNewestFirst(logs: AuditLogEntry[]): AuditLogEntry[] {
  return [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Validate that entityId is safe (no path traversal)
 */
function validateEntityId(entityId: string): boolean {
  // Entity IDs should be UUIDs or simple alphanumeric strings
  // Reject strings containing path separators or parent directory references
  const dangerousPatterns = ['..', '/', '\\', '\0'];
  return !dangerousPatterns.some(pattern => entityId.includes(pattern));
}

/**
 * Memory-based audit log repository for testing
 */
export function createInMemoryAuditLogRepository(
  seed: AuditLogEntry[] = []
): AuditLogRepository {
  const auditLogs = [...seed];

  return {
    async save(entry: AuditLogEntry) {
      auditLogs.push(entry);
    },

    async getById(id: string) {
      return auditLogs.find((log) => log.id === id) || null;
    },

    async getByEntityId(entityId: string) {
      if (!validateEntityId(entityId)) {
        throw new Error(`Invalid entityId: ${entityId}`);
      }
      return sortAuditLogsNewestFirst(
        auditLogs.filter((log) => log.entityId === entityId)
      );
    },

    async getByEntityType(entityType: AuditEntityType) {
      return sortAuditLogsNewestFirst(
        auditLogs.filter((log) => log.entityType === entityType)
      );
    },

    async getByActor(actor: string) {
      return sortAuditLogsNewestFirst(
        auditLogs.filter((log) => log.actor === actor)
      );
    },

    async getByTimeRange(start: string, end: string) {
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();

      return sortAuditLogsNewestFirst(
        auditLogs.filter((log) => {
          const timestamp = new Date(log.timestamp).getTime();
          return timestamp >= startTime && timestamp <= endTime;
        })
      );
    },
  };
}

/**
 * File-based audit log repository
 *
 * Stores audit logs in date-partitioned JSON files:
 * .ai/audit/YYYY-MM-DD.json
 *
 * Uses append-only writes to minimize race conditions.
 */
export class FileAuditLogRepository implements AuditLogRepository {
  private readonly auditDir: string;

  constructor(auditDir?: string) {
    this.auditDir =
      auditDir ||
      path.join(process.cwd(), '.ai', 'audit');

    // Ensure directory exists asynchronously
    fs.mkdir(this.auditDir, { recursive: true }).catch(() => {
      // Directory may already exist, ignore error
    });
  }

  /**
   * Get the file path for a specific date
   * Format: .ai/audit/YYYY-MM-DD.json
   */
  private getDateFilePath(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return path.join(this.auditDir, `${year}-${month}-${day}.json`);
  }

  /**
   * Read all audit logs from a specific date file
   */
  private async readDateFile(filePath: string): Promise<AuditLogEntry[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as AuditLogEntry[];
      }
      return [];
    } catch (error) {
      // Log warning for non-ENOENT errors
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to read audit file: ${filePath}`, error);
      }
      return [];
    }
  }

  /**
   * Write audit logs to a specific date file
   */
  private async writeDateFile(filePath: string, logs: AuditLogEntry[]): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
      console.error(`Failed to write audit file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Get all date files in the audit directory
   */
  private async getDateFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.auditDir);
      return files
        .filter((file) => file.endsWith('.json') && file.match(/^\d{4}-\d{2}-\d{2}\.json$/))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  async save(entry: AuditLogEntry): Promise<void> {
    const entryDate = new Date(entry.timestamp);
    const filePath = this.getDateFilePath(entryDate);
    const logs = await this.readDateFile(filePath);

    // Check for duplicates by ID
    const existingIndex = logs.findIndex((log) => log.id === entry.id);
    if (existingIndex >= 0) {
      logs[existingIndex] = entry;
    } else {
      logs.push(entry);
    }

    await this.writeDateFile(filePath, logs);
  }

  async getById(id: string): Promise<AuditLogEntry | null> {
    if (!validateEntityId(id)) {
      return null;
    }

    const dateFiles = await this.getDateFiles();

    // Limit search to recent files for performance
    const searchLimit = Math.min(dateFiles.length, 7);
    for (const file of dateFiles.slice(0, searchLimit)) {
      const filePath = path.join(this.auditDir, file);
      const logs = await this.readDateFile(filePath);
      const found = logs.find((log) => log.id === id);
      if (found) {
        return found;
      }
    }

    return null;
  }

  async getByEntityId(entityId: string): Promise<AuditLogEntry[]> {
    if (!validateEntityId(entityId)) {
      throw new Error(`Invalid entityId: ${entityId}`);
    }

    const results: AuditLogEntry[] = [];
    const dateFiles = await this.getDateFiles();

    for (const file of dateFiles) {
      const filePath = path.join(this.auditDir, file);
      const logs = await this.readDateFile(filePath);
      const matching = logs.filter((log) => log.entityId === entityId);
      results.push(...matching);
    }

    return sortAuditLogsNewestFirst(results);
  }

  async getByEntityType(entityType: AuditEntityType): Promise<AuditLogEntry[]> {
    const results: AuditLogEntry[] = [];
    const dateFiles = await this.getDateFiles();

    for (const file of dateFiles) {
      const filePath = path.join(this.auditDir, file);
      const logs = await this.readDateFile(filePath);
      const matching = logs.filter((log) => log.entityType === entityType);
      results.push(...matching);
    }

    return sortAuditLogsNewestFirst(results);
  }

  async getByActor(actor: string): Promise<AuditLogEntry[]> {
    const results: AuditLogEntry[] = [];
    const dateFiles = await this.getDateFiles();

    for (const file of dateFiles) {
      const filePath = path.join(this.auditDir, file);
      const logs = await this.readDateFile(filePath);
      const matching = logs.filter((log) => log.actor === actor);
      results.push(...matching);
    }

    return sortAuditLogsNewestFirst(results);
  }

  async getByTimeRange(start: string, end: string): Promise<AuditLogEntry[]> {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const results: AuditLogEntry[] = [];

    // Determine which date files to read based on range
    const startDate = new Date(start);
    const endDate = new Date(end);

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const filePath = this.getDateFilePath(currentDate);
      const logs = await this.readDateFile(filePath);
      const matching = logs.filter((log) => {
        const timestamp = new Date(log.timestamp).getTime();
        return timestamp >= startTime && timestamp <= endTime;
      });
      results.push(...matching);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return sortAuditLogsNewestFirst(results);
  }
}

/**
 * Factory function to create a file audit log repository
 */
export function createFileAuditLogRepository(
  auditDir?: string
): AuditLogRepository {
  return new FileAuditLogRepository(auditDir);
}
