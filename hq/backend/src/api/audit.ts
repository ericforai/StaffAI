import type express from 'express';
import type {
  AuditLogger,
  AuditQuery,
  AuditEntityType,
  AuditLogEntry
} from '../governance/audit-logger';
import type { Store } from '../store';

/**
 * Enriched audit log entry with entity details
 */
interface EnrichedAuditLogEntry extends AuditLogEntry {
  entityTitle?: string;
  entityTaskId?: string;
}

/**
 * Register audit log API routes
 *
 * Routes:
 * - GET /api/audit/:entityId - Get audit trail for a specific entity
 * - GET /api/audit - Query audit logs with filters
 */
export function registerAuditRoutes(
  app: express.Application,
  auditLogger: AuditLogger,
  store: Pick<Store, 'getTaskById' | 'getExecutionById'>
) {
  /**
   * GET /api/audit/:entityId
   * Get complete audit trail for a specific entity
   */
  app.get('/api/audit/:entityId', async (req, res) => {
    try {
      const { entityId } = req.params;

      if (!entityId) {
        res.status(400).json({ error: 'entityId is required' });
        return;
      }

      const auditTrail = await auditLogger.getAuditTrail(entityId);

      // Try to enrich with entity details
      const enrichedTrail: EnrichedAuditLogEntry[] = await Promise.all(
        auditTrail.map(async (entry): Promise<EnrichedAuditLogEntry> => {
          const enriched: EnrichedAuditLogEntry = { ...entry };

          // Add entity details based on type
          if (entry.entityType === 'task') {
            const task = await store.getTaskById(entry.entityId);
            if (task) {
              enriched.entityTitle = task.title;
            }
          } else if (entry.entityType === 'execution') {
            const execution = await store.getExecutionById(entry.entityId);
            if (execution) {
              enriched.entityTaskId = execution.taskId;
            }
          }

          return enriched;
        })
      );

      res.json({
        entityId,
        count: enrichedTrail.length,
        auditTrail: enrichedTrail,
      });
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
  });

  /**
   * GET /api/audit
   * Query audit logs with filters
   *
   * Query parameters:
   * - entityType: Filter by entity type (approval, task, execution, tool_call)
   * - actor: Filter by actor
   * - start: ISO 8601 start time
   * - end: ISO 8601 end time
   * - limit: Maximum number of results (default: 100)
   */
  app.get('/api/audit', async (req, res) => {
    try {
      const {
        entityType,
        entityId,
        actor,
        start,
        end,
        limit,
      } = req.query as Record<string, string>;

      const query: AuditQuery = {};

      if (entityType) {
        const validTypes: AuditEntityType[] = ['approval', 'task', 'execution', 'tool_call'];
        if (!validTypes.includes(entityType as AuditEntityType)) {
          res.status(400).json({
            error: `Invalid entityType. Must be one of: ${validTypes.join(', ')}`,
          });
          return;
        }
        query.entityType = entityType as AuditEntityType;
      }

      if (entityId) {
        query.entityId = entityId;
      }

      if (actor) {
        query.actor = actor;
      }

      if (start && end) {
        // Validate ISO 8601 format
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          res.status(400).json({ error: 'Invalid start or end time format' });
          return;
        }

        query.startTime = start;
        query.endTime = end;
      }

      if (limit) {
        const parsedLimit = Number.parseInt(limit, 10);
        if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
          res.status(400).json({ error: 'limit must be between 1 and 1000' });
          return;
        }
        query.limit = parsedLimit;
      } else {
        query.limit = 100;
      }

      const results = await auditLogger.query(query);

      res.json({
        query,
        count: results.length,
        auditLogs: results,
      });
    } catch (error) {
      console.error('Error querying audit logs:', error);
      res.status(500).json({ error: 'Failed to query audit logs' });
    }
  });

  /**
   * GET /api/audit/types
   * Get available entity types for audit filtering
   */
  app.get('/api/audit/types', (_req, res) => {
    res.json({
      types: ['approval', 'task', 'execution', 'tool_call'],
    });
  });

  /**
   * GET /api/audit/actions
   * Get available actions for audit filtering
   */
  app.get('/api/audit/actions', (_req, res) => {
    res.json({
      actions: [
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
      ],
    });
  });
}
