// ============================================================
// CRM Shared Types — immutable data models + Zod schemas
// ============================================================

// ── Roles & Permissions ─────────────────────────────────────

export type Role = 'admin' | 'manager' | 'sales' | 'readonly';

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  manager: 50,
  sales: 20,
  readonly: 0,
};

/** What a role may do */
export type Permission =
  | 'contacts:read' | 'contacts:write' | 'contacts:delete'
  | 'companies:read' | 'companies:write' | 'companies:delete'
  | 'deals:read' | 'deals:write' | 'deals:delete'
  | 'users:read' | 'users:write' | 'users:delete'
  | 'admin:manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'contacts:read', 'contacts:write', 'contacts:delete',
    'companies:read', 'companies:write', 'companies:delete',
    'deals:read', 'deals:write', 'deals:delete',
    'users:read', 'users:write', 'users:delete',
    'admin:manage',
  ],
  manager: [
    'contacts:read', 'contacts:write', 'contacts:delete',
    'companies:read', 'companies:write', 'companies:delete',
    'deals:read', 'deals:write', 'deals:delete',
    'users:read',
  ],
  sales: [
    'contacts:read', 'contacts:write',
    'companies:read', 'companies:write',
    'deals:read', 'deals:write',
  ],
  readonly: [
    'contacts:read',
    'companies:read',
    'deals:read',
  ],
};

// ── Core Entities ────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string; // ISO-8601
  updatedAt: string;
  active: boolean;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyId: string | null;
  ownerId: string;
  stage: ContactStage;
  createdAt: string;
  updatedAt: string;
}

export type ContactStage = 'new' | 'contacted' | 'qualified' | 'lost';

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: CompanySize;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CompanySize = 'startup' | 'smb' | 'enterprise';

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: DealStage;
  contactId: string;
  companyId: string;
  ownerId: string;
  expectedCloseDate: string;
  createdAt: string;
  updatedAt: string;
}

export type DealStage = 'prospecting' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

// ── Audit Log ────────────────────────────────────────────────

export type AuditAction = 'ALLOWED' | 'BLOCKED' | 'REVIEW_REQUIRED';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: Role;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_DELETE' | 'ADMIN_ACTION';
  resource: string;       // e.g. "contact", "company", "deal"
  resourceId: string;
  outcome: AuditAction;
  reason?: string;        // why blocked / requires review
  metadata?: Record<string, unknown>;
}

// ── API Response ──────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { page?: number; limit?: number; total?: number };
}
