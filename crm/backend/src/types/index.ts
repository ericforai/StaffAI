export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface Deal {
  id: string;
  title: string;
  companyId: string;
  contactId: string;
  amount: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type RelatedType = 'contact' | 'company' | 'deal';

export interface Task {
  id: string;
  title: string;
  description: string;
  relatedType: RelatedType | null;
  relatedId: string | null;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null };
}

export function fail(error: string): ApiResponse<never> {
  return { success: false, data: null, error };
}

// ─── Roles & Permissions ─────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'sales' | 'readonly';

const _ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  manager: 50,
  sales: 20,
  readonly: 0,
};

export type Permission =
  | 'contacts:read' | 'contacts:write' | 'contacts:delete'
  | 'companies:read' | 'companies:write' | 'companies:delete'
  | 'deals:read' | 'deals:write' | 'deals:delete'
  | 'tasks:read' | 'tasks:write' | 'tasks:delete'
  | 'users:read' | 'users:write' | 'users:delete'
  | 'admin:manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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

// ─── Audit Log ───────────────────────────────────────────────────────────────────

export type AuditAction = 'ALLOWED' | 'BLOCKED' | 'REVIEW_REQUIRED';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: Role;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_DELETE' | 'ADMIN_ACTION';
  resource: string;
  resourceId: string;
  outcome: AuditAction;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ─── User ────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
