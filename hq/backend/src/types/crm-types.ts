import { z } from 'zod';

// ─── Enums & Constants ────────────────────────────────────────────────────────

export const DEAL_STAGES = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  companyId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateContactSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(200),
  email: z.string().email('邮箱格式不正确').optional(),
  phone: z.string().max(50).optional(),
  companyId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;
export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional(),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  address: z.string().max(300).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateCompanySchema = z.object({
  name: z.string().min(1, '公司名称不能为空').max(200),
  industry: z.string().max(100).optional(),
  website: z.string().url('网站URL格式不正确').optional().or(z.literal('').transform(() => undefined)),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  address: z.string().max(300).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type Company = z.infer<typeof CompanySchema>;
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const DealSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(300),
  value: z.number().min(0).default(0),
  stage: z.enum(DEAL_STAGES),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  expectedClose: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateDealSchema = z.object({
  title: z.string().min(1, '商机名称不能为空').max(300),
  value: z.number().min(0).default(0),
  stage: z.enum(DEAL_STAGES).default('prospecting'),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  expectedClose: z.string().optional(),
  description: z.string().optional(),
});

export const UpdateDealStageSchema = z.object({
  stage: z.enum(DEAL_STAGES),
});

export type Deal = z.infer<typeof DealSchema>;
export type CreateDealInput = z.infer<typeof CreateDealSchema>;
export type UpdateDealStageInput = z.infer<typeof UpdateDealStageSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().min(1).max(300),
  body: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  createdAt: z.string(),
});

export const CreateActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().min(1, '主题不能为空').max(300),
  body: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ContactWithCompany extends Contact {
  company?: Company;
}

export interface DealWithRelations extends Deal {
  contact?: Contact;
  company?: Company;
}

export interface CrmDashboardData {
  contactCount: number;
  companyCount: number;
  dealCount: number;
  totalPipelineValue: number;
  stageBreakdown: Record<DealStage, { count: number; value: number }>;
  recentActivities: Activity[];
  topDeals: Deal[];
}

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface ContactRepository {
  list(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  getByCompanyId(companyId: string): Promise<Contact[]>;
  save(contact: Contact): Promise<void>;
  update(id: string, updater: (contact: Contact) => Contact): Promise<Contact | null>;
  delete(id: string): Promise<boolean>;
}

export interface CompanyRepository {
  list(): Promise<Company[]>;
  getById(id: string): Promise<Company | null>;
  save(company: Company): Promise<void>;
  update(id: string, updater: (company: Company) => Company): Promise<Company | null>;
  delete(id: string): Promise<boolean>;
}

export interface DealRepository {
  list(): Promise<Deal[]>;
  getById(id: string): Promise<Deal | null>;
  getByStage(stage: DealStage): Promise<Deal[]>;
  save(deal: Deal): Promise<void>;
  update(id: string, updater: (deal: Deal) => Deal): Promise<Deal | null>;
  delete(id: string): Promise<boolean>;
}

export interface ActivityRepository {
  list(): Promise<Activity[]>;
  getById(id: string): Promise<Activity | null>;
  getByContactId(contactId: string): Promise<Activity[]>;
  getByCompanyId(companyId: string): Promise<Activity[]>;
  getByDealId(dealId: string): Promise<Activity[]>;
  save(activity: Activity): Promise<void>;
  delete(id: string): Promise<boolean>;
}
