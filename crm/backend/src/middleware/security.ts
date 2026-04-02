// ============================================================
// Security Middleware — RBAC + Auth for Express
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import type { Role, Permission, AuditEntry } from '../types';

// ── Extend Express Request ─────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      currentUser?: { id: string; email: string; role: Role; name: string };
    }
  }
}

// ── Simple In-Memory Session Store ────────────────────────────
// Demo only — replace with JWT / Redis in production

const sessions = new Map<string, { id: string; email: string; role: Role; name: string }>();

export function createSession(token: string, user: { id: string; email: string; role: Role; name: string }): void {
  sessions.set(token, user);
}

export function getSession(token: string) {
  return sessions.get(token) ?? null;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

// ── Auth Middleware ───────────────────────────────────────────

/** Extracts Bearer token and attaches currentUser to req */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const session = sessions.get(header.slice(7));
    if (session) req.currentUser = session;
  }
  next();
}

/** Requires user to be authenticated */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  next();
}

// ── RBAC ─────────────────────────────────────────────────────

const ROLE_PERMISSIONS_MAP: Record<Role, Permission[]> = {
  admin: [
    'contacts:read', 'contacts:write', 'contacts:delete',
    'companies:read', 'companies:write', 'companies:delete',
    'deals:read', 'deals:write', 'deals:delete',
    'tasks:read', 'tasks:write', 'tasks:delete',
    'users:read', 'users:write', 'users:delete',
    'admin:manage',
  ],
  manager: [
    'contacts:read', 'contacts:write', 'contacts:delete',
    'companies:read', 'companies:write', 'companies:delete',
    'deals:read', 'deals:write', 'deals:delete',
    'tasks:read', 'tasks:write', 'tasks:delete',
    'users:read',
  ],
  sales: [
    'contacts:read', 'contacts:write',
    'companies:read', 'companies:write',
    'deals:read', 'deals:write',
    'tasks:read', 'tasks:write',
  ],
  readonly: [
    'contacts:read',
    'companies:read',
    'deals:read',
    'tasks:read',
  ],
};

/** Check if a role has a specific permission */
export function hasPermission(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS_MAP[role] ?? []).includes(permission);
}

/**
 * Require a specific permission — returns 403 if denied.
 * Safe for all HTTP methods.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }
    if (!hasPermission(req.currentUser.role, permission)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: role '${req.currentUser.role}' lacks permission '${permission}'.`,
      });
      return;
    }
    next();
  };
}

// ── Risk Assessment ──────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ActionContext {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_DELETE' | 'ADMIN_ACTION';
  resource: string;
  resourceId: string;
  userId: string;
  userRole: Role;
  payload?: Record<string, unknown>;
}

interface RiskPattern { resource: string; keyword: string; level: RiskLevel; reason: string }

const CRITICAL_PATTERNS: RiskPattern[] = [
  { resource: 'user', keyword: 'delete', level: 'critical', reason: 'User deletion is permanently blocked.' },
  { resource: 'user', keyword: 'role', level: 'critical', reason: 'Role changes are permanently blocked.' },
  { resource: '*', keyword: 'force_reset', level: 'critical', reason: 'System reset is permanently blocked.' },
];

const HIGH_RISK_PATTERNS: RiskPattern[] = [
  { resource: 'deal', keyword: 'delete', level: 'high', reason: 'Deal deletion requires admin approval.' },
  { resource: 'contact', keyword: 'bulk_delete', level: 'high', reason: 'Bulk deletion requires admin approval.' },
  { resource: 'company', keyword: 'bulk_delete', level: 'high', reason: 'Bulk deletion requires admin approval.' },
];

const MEDIUM_RISK_PATTERNS: RiskPattern[] = [
  { resource: 'contact', keyword: 'delete', level: 'medium', reason: 'Contact deletion requires sufficient privileges.' },
  { resource: 'company', keyword: 'delete', level: 'medium', reason: 'Company deletion requires sufficient privileges.' },
  { resource: 'user', keyword: 'write', level: 'medium', reason: 'User modification requires sufficient privileges.' },
];

export function assessRisk(ctx: ActionContext): { level: RiskLevel; reason: string } {
  for (const p of CRITICAL_PATTERNS) {
    if ((p.resource === '*' || ctx.resource === p.resource) && matchesKeyword(ctx, p.keyword)) {
      return { level: 'critical', reason: `CRITICAL: ${p.reason}` };
    }
  }
  for (const p of HIGH_RISK_PATTERNS) {
    if ((p.resource === '*' || ctx.resource === p.resource) && matchesKeyword(ctx, p.keyword)) {
      return { level: 'high', reason: `HIGH RISK: ${p.reason}` };
    }
  }
  for (const p of MEDIUM_RISK_PATTERNS) {
    if ((p.resource === '*' || ctx.resource === p.resource) && matchesKeyword(ctx, p.keyword)) {
      return { level: 'medium', reason: `MEDIUM RISK: ${p.reason}` };
    }
  }
  return { level: 'low', reason: 'Low risk: proceeding.' };
}

function matchesKeyword(ctx: ActionContext, keyword: string): boolean {
  const haystack = [
    ctx.action.toLowerCase(),
    ctx.resource.toLowerCase(),
    ctx.resourceId.toLowerCase(),
    JSON.stringify(ctx.payload ?? '').toLowerCase(),
  ].join(' ');
  return haystack.includes(keyword);
}

// ── Audit Logger ─────────────────────────────────────────────

const auditEntries: AuditEntry[] = [];

export function logAudit(
  ctx: ActionContext,
  outcome: AuditEntry['outcome'],
  reason?: string,
  metadata?: Record<string, unknown>
): AuditEntry {
  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    userId: ctx.userId,
    userRole: ctx.userRole,
    action: ctx.action,
    resource: ctx.resource,
    resourceId: ctx.resourceId,
    outcome,
    reason,
    metadata,
  };
  auditEntries.push(entry);
  return entry;
}

export function queryAudit(filters?: {
  userId?: string; resource?: string; outcome?: AuditEntry['outcome'];
}): AuditEntry[] {
  return auditEntries.filter(e => {
    if (filters?.userId && e.userId !== filters.userId) return false;
    if (filters?.resource && e.resource !== filters.resource) return false;
    if (filters?.outcome && e.outcome !== filters.outcome) return false;
    return true;
  });
}

export function getAllAuditEntries(): AuditEntry[] {
  return [...auditEntries];
}

/**
 * Pre-execution security gate — call before any mutation.
 * Returns null = allowed to proceed.
 * Returns AuditEntry = blocked/review-required, caller must respond.
 */
export function securityGate(
  ctx: ActionContext
): null | { status: number; entry: AuditEntry } {
  // Always block readonly for any mutation
  if (ctx.userRole === 'readonly') {
    const entry = logAudit(ctx, 'BLOCKED', `Role '${ctx.userRole}' may not perform mutations.`);
    return { status: 403, entry };
  }

  const { level, reason } = assessRisk(ctx);

  if (level === 'critical') {
    const entry = logAudit(ctx, 'BLOCKED', reason);
    return { status: 403, entry };
  }

  if (level === 'high') {
    const entry = logAudit(ctx, 'REVIEW_REQUIRED', reason);
    return { status: 202, entry };
  }

  return null; // proceed
}

export function buildCtx(
  req: Request,
  action: ActionContext['action'],
  resource: string,
  resourceId?: string
): ActionContext {
  return {
    action,
    resource,
    resourceId: resourceId ?? req.params.id ?? 'unknown',
    userId: req.currentUser?.id ?? 'unknown',
    userRole: req.currentUser?.role ?? 'readonly',
    payload: req.body ?? undefined,
  };
}
