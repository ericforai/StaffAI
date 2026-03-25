import type { Store } from '../store';
import type { AuditLogger, AuditEvent } from '../governance/audit-logger';

/**
 * Log an audit event for assignment execution
 */
export async function logAssignmentAuditEvent(
  store: Pick<Store, 'logAudit'>,
  auditLogger: AuditLogger | null,
  event: {
    entityType: 'execution';
    entityId: string;
    action: string;
    actor: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    reason?: string;
  }
): Promise<void> {
  if (auditLogger) {
    await store.logAudit?.(event as AuditEvent);
  }
}
