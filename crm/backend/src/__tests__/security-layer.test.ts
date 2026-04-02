// ============================================================
// Security Layer — Unit Tests
// ============================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  hasPermission,
  assessRisk,
  securityGate,
  logAudit,
  queryAudit,
  getAllAuditEntries,
  buildCtx,
} from '../middleware/security';
import { ROLE_PERMISSIONS } from '../types/index.js';
import type { Role, Permission } from '../types/index.js';
import type { ActionContext } from '../middleware/security.js';

// ── Permission Tests ─────────────────────────────────────────

describe('hasPermission — RBAC', () => {
  it('admin has all permissions', () => {
    const perms = ROLE_PERMISSIONS['admin'];
    assert.ok(perms.includes('contacts:read'));
    assert.ok(perms.includes('contacts:write'));
    assert.ok(perms.includes('contacts:delete'));
    assert.ok(perms.includes('companies:delete'));
    assert.ok(perms.includes('deals:delete'));
    assert.ok(perms.includes('admin:manage'));
  });

  it('manager has most permissions but not admin:manage or users:write', () => {
    assert.ok(hasPermission('manager', 'contacts:delete'));
    assert.ok(hasPermission('manager', 'deals:delete'));
    assert.ok(!hasPermission('manager', 'admin:manage'));
    assert.ok(!hasPermission('manager', 'users:write'));
  });

  it('sales can read/write contacts and deals but not delete', () => {
    assert.ok(hasPermission('sales', 'contacts:read'));
    assert.ok(hasPermission('sales', 'contacts:write'));
    assert.ok(!hasPermission('sales', 'contacts:delete'));
    assert.ok(hasPermission('sales', 'deals:read'));
    assert.ok(hasPermission('sales', 'deals:write'));
    assert.ok(!hasPermission('sales', 'deals:delete'));
  });

  it('readonly can only read', () => {
    assert.ok(hasPermission('readonly', 'contacts:read'));
    assert.ok(hasPermission('readonly', 'companies:read'));
    assert.ok(hasPermission('readonly', 'deals:read'));
    assert.ok(!hasPermission('readonly', 'contacts:write'));
    assert.ok(!hasPermission('readonly', 'deals:write'));
    assert.ok(!hasPermission('readonly', 'deals:delete'));
  });

  it('ROLE_PERMISSIONS exports are arrays (not mutated by pop)', () => {
    // Verify admin has the expected number of permissions
    assert.ok(Array.isArray(ROLE_PERMISSIONS['admin']));
    assert.ok(Array.isArray(ROLE_PERMISSIONS['sales']));
    assert.ok(Array.isArray(ROLE_PERMISSIONS['readonly']));
    assert.ok(ROLE_PERMISSIONS['admin'].length > ROLE_PERMISSIONS['readonly'].length);
  });
});

// ── Risk Assessment Tests ────────────────────────────────────

describe('assessRisk', () => {
  const ctx = (action: ActionContext['action'], resource: string, id = 'x'): ActionContext =>
    ({ action, resource, resourceId: id, userId: 'u1', userRole: 'admin', payload: {} });

  it('CRITICAL: user DELETE is permanently blocked', () => {
    const { level, reason } = assessRisk(ctx('DELETE', 'user'));
    assert.strictEqual(level, 'critical');
    assert.ok(reason.includes('CRITICAL'));
  });

  it('CRITICAL: user role change is permanently blocked', () => {
    const { level, reason } = assessRisk({ ...ctx('UPDATE', 'user', 'role'), payload: { role: 'admin' } });
    assert.strictEqual(level, 'critical');
    assert.ok(reason.includes('CRITICAL'));
  });

  it('HIGH: deal DELETE requires approval', () => {
    const { level, reason } = assessRisk(ctx('DELETE', 'deal', 'd1'));
    assert.strictEqual(level, 'high');
    assert.ok(reason.includes('HIGH RISK'));
  });

  it('HIGH: contact bulk_delete requires approval', () => {
    const { level } = assessRisk({ ...ctx('BULK_DELETE', 'contact'), payload: { ids: ['1', '2'] } });
    assert.strictEqual(level, 'high');
  });

  it('MEDIUM: contact DELETE requires sufficient privileges', () => {
    const { level } = assessRisk(ctx('DELETE', 'contact'));
    assert.strictEqual(level, 'medium');
  });

  it('MEDIUM: company DELETE requires sufficient privileges', () => {
    const { level } = assessRisk(ctx('DELETE', 'company'));
    assert.strictEqual(level, 'medium');
  });

  it('LOW: creating a contact is low risk', () => {
    const { level } = assessRisk(ctx('CREATE', 'contact'));
    assert.strictEqual(level, 'low');
  });

  it('LOW: updating a deal is low risk', () => {
    const { level } = assessRisk(ctx('UPDATE', 'deal'));
    assert.strictEqual(level, 'low');
  });
});

// ── Security Gate Tests ──────────────────────────────────────

describe('securityGate', () => {
  const ctx = (role: Role, action: ActionContext['action'], resource: string, id = 'x'): ActionContext =>
    ({ action, resource, resourceId: id, userId: 'u1', userRole: role, payload: {} });

  it('blocks CRITICAL operations for all roles (admin)', () => {
    const result = securityGate(ctx('admin', 'DELETE', 'user'));
    assert.ok(result !== null);
    assert.strictEqual(result!.status, 403);
    assert.strictEqual(result!.entry.outcome, 'BLOCKED');
  });

  it('blocks CRITICAL operations for manager role', () => {
    const result = securityGate(ctx('manager', 'DELETE', 'user'));
    assert.ok(result !== null);
    assert.strictEqual(result!.entry.outcome, 'BLOCKED');
  });

  it('blocks readonly from any mutation — returns 403', () => {
    const result = securityGate(ctx('readonly', 'UPDATE', 'contact', 'c1'));
    assert.ok(result !== null);
    assert.strictEqual(result!.status, 403);
    assert.strictEqual(result!.entry.outcome, 'BLOCKED');
  });

  it('blocks HIGH-risk deal DELETE — returns 202 (review required)', () => {
    const result = securityGate(ctx('admin', 'DELETE', 'deal', 'd1'));
    assert.ok(result !== null);
    assert.strictEqual(result!.status, 202);
    assert.strictEqual(result!.entry.outcome, 'REVIEW_REQUIRED');
  });

  it('allows admin to CREATE a contact', () => {
    const result = securityGate(ctx('admin', 'CREATE', 'contact'));
    assert.strictEqual(result, null);
  });

  it('allows sales to CREATE a contact', () => {
    const result = securityGate(ctx('sales', 'CREATE', 'contact'));
    assert.strictEqual(result, null);
  });

  it('allows admin to UPDATE a deal', () => {
    const result = securityGate(ctx('admin', 'UPDATE', 'deal', 'd1'));
    assert.strictEqual(result, null);
  });

  it('allows sales to UPDATE a deal', () => {
    const result = securityGate(ctx('sales', 'UPDATE', 'deal', 'd1'));
    assert.strictEqual(result, null);
  });

  it('allows admin to DELETE a contact (medium risk, not blocked)', () => {
    const result = securityGate(ctx('admin', 'DELETE', 'contact', 'c1'));
    assert.strictEqual(result, null);
  });
});

// ── Audit Logger Tests ───────────────────────────────────────

describe('logAudit / queryAudit / getAllAuditEntries', () => {
  beforeEach(() => {
    // Clear entries from prior tests by getting all and noting — entries are append-only
    // so we test filtering rather than asserting exact counts
  });

  it('logAudit returns an AuditEntry with a unique id', () => {
    const entry = logAudit(
      { action: 'DELETE', resource: 'contact', resourceId: 'c1', userId: 'u1', userRole: 'readonly' },
      'BLOCKED',
      'readonly role'
    );
    assert.ok(entry.id.startsWith('audit_'));
    assert.strictEqual(entry.outcome, 'BLOCKED');
    assert.strictEqual(entry.reason, 'readonly role');
    assert.strictEqual(entry.userId, 'u1');
    assert.strictEqual(entry.resource, 'contact');
    assert.strictEqual(entry.resourceId, 'c1');
    assert.ok(entry.timestamp.length > 0);
  });

  it('logAudit records ALLOWED outcomes', () => {
    const entry = logAudit(
      { action: 'CREATE', resource: 'contact', resourceId: 'c2', userId: 'u1', userRole: 'admin' },
      'ALLOWED'
    );
    assert.strictEqual(entry.outcome, 'ALLOWED');
    assert.strictEqual(entry.reason, undefined);
  });

  it('logAudit records REVIEW_REQUIRED outcomes with metadata', () => {
    const entry = logAudit(
      { action: 'DELETE', resource: 'deal', resourceId: 'd1', userId: 'u2', userRole: 'admin' },
      'REVIEW_REQUIRED',
      'Deal deletion requires admin approval.',
      { dealId: 'd1' }
    );
    assert.strictEqual(entry.outcome, 'REVIEW_REQUIRED');
    assert.deepStrictEqual(entry.metadata, { dealId: 'd1' });
  });

  it('queryAudit filters by userId', () => {
    logAudit({ action: 'CREATE', resource: 'contact', resourceId: 'x', userId: 'u1', userRole: 'admin' }, 'ALLOWED');
    logAudit({ action: 'CREATE', resource: 'contact', resourceId: 'y', userId: 'u2', userRole: 'admin' }, 'ALLOWED');
    const results = queryAudit({ userId: 'u1' });
    assert.ok(results.every(e => e.userId === 'u1'));
  });

  it('queryAudit filters by outcome', () => {
    logAudit({ action: 'DELETE', resource: 'user', resourceId: 'x', userId: 'u3', userRole: 'readonly' }, 'BLOCKED');
    logAudit({ action: 'CREATE', resource: 'contact', resourceId: 'x', userId: 'u3', userRole: 'admin' }, 'ALLOWED');
    const blocked = queryAudit({ outcome: 'BLOCKED' });
    assert.ok(blocked.every(e => e.outcome === 'BLOCKED'));
  });

  it('queryAudit filters by resource', () => {
    logAudit({ action: 'DELETE', resource: 'contact', resourceId: 'x', userId: 'u4', userRole: 'admin' }, 'ALLOWED');
    logAudit({ action: 'DELETE', resource: 'deal', resourceId: 'x', userId: 'u4', userRole: 'admin' }, 'ALLOWED');
    const contacts = queryAudit({ resource: 'contact' });
    assert.ok(contacts.every(e => e.resource === 'contact'));
  });

  it('getAllAuditEntries returns all entries', () => {
    const before = getAllAuditEntries().length;
    logAudit({ action: 'UPDATE', resource: 'deal', resourceId: 'x', userId: 'u1', userRole: 'admin' }, 'ALLOWED');
    const after = getAllAuditEntries().length;
    assert.ok(after > before);
  });
});

// ── buildCtx Tests ───────────────────────────────────────────

describe('buildCtx', () => {
  it('creates an ActionContext from a mock Express request', () => {
    const mockReq = {
      currentUser: { id: 'u-admin', email: 'admin@crm.dev', role: 'admin' as Role, name: 'Admin' },
      params: { id: 'c1' },
      body: { name: 'Acme Corp' },
    } as unknown as import('express').Request;
    const ctx = buildCtx(mockReq, 'UPDATE', 'company', 'c1');
    assert.strictEqual(ctx.action, 'UPDATE');
    assert.strictEqual(ctx.resource, 'company');
    assert.strictEqual(ctx.resourceId, 'c1');
    assert.strictEqual(ctx.userId, 'u-admin');
    assert.strictEqual(ctx.userRole, 'admin');
    assert.deepStrictEqual(ctx.payload, { name: 'Acme Corp' });
  });

  it('uses req.params.id as resourceId when resourceId is omitted', () => {
    const mockReq = {
      currentUser: { id: 'u-sales', email: 'sales@crm.dev', role: 'sales' as Role, name: 'Sales' },
      params: { id: 'd5' },
      body: {},
    } as unknown as import('express').Request;
    const ctx = buildCtx(mockReq, 'DELETE', 'deal');
    assert.strictEqual(ctx.resourceId, 'd5');
  });

  it('defaults to "readonly" when no user is present', () => {
    const mockReq = { params: {}, body: {} } as unknown as import('express').Request;
    const ctx = buildCtx(mockReq, 'CREATE', 'contact');
    assert.strictEqual(ctx.userRole, 'readonly');
    assert.strictEqual(ctx.userId, 'unknown');
  });
});
