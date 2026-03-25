import { randomUUID } from 'node:crypto';
import type { AuditLogRepository } from '../persistence/audit-log-repositories';

/**
 * Entity types that can be audited
 */
export const AUDIT_ENTITY_TYPES = ['approval', 'task', 'execution', 'tool_call'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * Standard actions for audit logging
 */
export const AUDIT_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'status_changed',
  'approved',
  'rejected',
  'started',
  'completed',
  'failed',
  'cancelled',
  'retried',
  'assigned',
  'unassigned',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Audit log entry representing a single state change or action
 */
export interface AuditLogEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction | string;
  actor: string;
  timestamp: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new audit log entry
 */
export interface AuditEvent {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction | string;
  actor: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Query parameters for audit log searches
 */
export interface AuditQuery {
  entityType?: AuditEntityType;
  entityId?: string;
  actor?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

/**
 * Service for recording and retrieving audit logs
 * Provides a complete history of all state changes and actions
 */
export class AuditLogger {
  constructor(private readonly repository: AuditLogRepository) {}

  /**
   * Record a new audit event
   * @param event The audit event to record
   * @returns The created audit log entry with generated ID and timestamp
   */
  async log(event: AuditEvent): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    await this.repository.save(entry);
    return entry;
  }

  /**
   * Get complete audit trail for a specific entity
   * @param entityId The ID of the entity
   * @returns Array of audit log entries ordered by timestamp (newest first)
   */
  async getAuditTrail(entityId: string): Promise<AuditLogEntry[]> {
    return await this.repository.getByEntityId(entityId);
  }

  /**
   * Alias for getAuditTrail to maintain compatibility with older tests
   */
  async getByEntityId(entityId: string): Promise<AuditLogEntry[]> {
    return await this.getAuditTrail(entityId);
  }

  /**
   * Get audit logs filtered by entity type
   * @param entityType The type of entity
   * @returns Array of audit log entries
   */
  async getAuditLogsByType(entityType: AuditEntityType): Promise<AuditLogEntry[]> {
    return await this.repository.getByEntityType(entityType);
  }

  /**
   * Get audit logs filtered by actor
   * @param actor The actor (user or system) who performed the action
   * @returns Array of audit log entries
   */
  async getAuditLogsByActor(actor: string): Promise<AuditLogEntry[]> {
    return await this.repository.getByActor(actor);
  }

  /**
   * Get audit logs within a time range
   * @param start ISO 8601 start time
   * @param end ISO 8601 end time
   * @returns Array of audit log entries
   */
  async getAuditLogsByTimeRange(start: string, end: string): Promise<AuditLogEntry[]> {
    return await this.repository.getByTimeRange(start, end);
  }

  /**
   * Query audit logs with multiple filters
   * @param query Query parameters
   * @returns Array of audit log entries matching the query
   */
  async query(query: AuditQuery): Promise<AuditLogEntry[]> {
    let results: AuditLogEntry[] = [];

    if (query.entityId) {
      results = await this.repository.getByEntityId(query.entityId);
    } else if (query.entityType) {
      results = await this.repository.getByEntityType(query.entityType);
    } else if (query.actor) {
      results = await this.repository.getByActor(query.actor);
    } else if (query.startTime && query.endTime) {
      results = await this.repository.getByTimeRange(query.startTime, query.endTime);
    } else {
      // No filters - return empty rather than all logs for safety
      return [];
    }

    // Apply time range filter if not already applied
    if (query.startTime && query.endTime && !query.entityId) {
      const start = new Date(query.startTime).getTime();
      const end = new Date(query.endTime).getTime();
      results = results.filter(entry => {
        const timestamp = new Date(entry.timestamp).getTime();
        return timestamp >= start && timestamp <= end;
      });
    }

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get a specific audit log entry by ID
   * @param id The audit log entry ID
   * @returns The audit log entry or null if not found
   */
  async getById(id: string): Promise<AuditLogEntry | null> {
    return await this.repository.getById(id);
  }
}

/**
 * Factory function to create an AuditLogger from a Store-like object
 */
export function createAuditLogger(store: { getAuditLogger(): AuditLogger | null }): AuditLogger {
  const logger = store.getAuditLogger();
  if (!logger) {
    throw new Error('Audit logger not initialized in store');
  }
  return logger;
}

/**
 * Create a sanitized state snapshot for audit logging
 * Removes sensitive or large fields that shouldn't be stored in audit logs
 */
export function sanitizeState(state: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const excludedKeys = ['password', 'token', 'secret', 'apikey', 'privatekey', 'session'];

  for (const [key, value] of Object.entries(state)) {
    const lowerKey = key.toLowerCase();
    if (excludedKeys.some(excluded => lowerKey.includes(excluded))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeState(value as Record<string, unknown>);
    } else if (Array.isArray(value) && value.length > 100) {
      // Truncate large arrays
      sanitized[key] = `[${value.length} items, truncated]`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extract state changes for audit logging
 * Compares two states and returns the differences
 */
export function extractStateChanges(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown>
): Record<string, unknown> {
  if (!previous) {
    return { all: current };
  }

  const changes: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    const previousValue = previous[key];
    if (JSON.stringify(previousValue) !== JSON.stringify(value)) {
      changes[key] = { from: previousValue, to: value };
    }
  }

  return changes;
}
