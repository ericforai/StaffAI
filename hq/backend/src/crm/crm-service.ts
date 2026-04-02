import { randomUUID } from 'node:crypto';
import type {
  Contact,
  Company,
  Deal,
  Activity,
  DealStage,
  ContactRepository,
  CompanyRepository,
  DealRepository,
  ActivityRepository,
  CreateContactInput,
  CreateCompanyInput,
  CreateDealInput,
  CreateActivityInput,
  UpdateDealStageInput,
  CrmDashboardData,
  DealWithRelations,
  ContactWithCompany,
} from '../types/crm-types';

// ─── ID Generation ────────────────────────────────────────────────────────────

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

// ─── Contact Service ───────────────────────────────────────────────────────────

export interface ContactService {
  list(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  getWithCompany(id: string): Promise<ContactWithCompany | null>;
  getByCompanyId(companyId: string): Promise<Contact[]>;
  create(input: CreateContactInput): Promise<Contact>;
  update(id: string, input: Partial<CreateContactInput>): Promise<Contact | null>;
  delete(id: string): Promise<boolean>;
}

export function createContactService(repo: ContactRepository, companyRepo: CompanyRepository): ContactService {
  return {
    async list() {
      return repo.list();
    },

    async getById(id) {
      return repo.getById(id);
    },

    async getWithCompany(id) {
      const contact = await repo.getById(id);
      if (!contact) return null;
      if (!contact.companyId) return { ...contact, company: undefined };
      const company = await companyRepo.getById(contact.companyId);
      return { ...contact, company: company ?? undefined };
    },

    async getByCompanyId(companyId) {
      return repo.getByCompanyId(companyId);
    },

    async create(input) {
      const now = new Date().toISOString();
      const contact: Contact = {
        id: newId('contact'),
        name: input.name,
        email: input.email,
        phone: input.phone,
        companyId: input.companyId,
        tags: input.tags ?? [],
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };
      await repo.save(contact);
      return contact;
    },

    async update(id, input) {
      return repo.update(id, (existing) => ({
        ...existing,
        name: input.name ?? existing.name,
        email: input.email ?? existing.email,
        phone: input.phone ?? existing.phone,
        companyId: input.companyId ?? existing.companyId,
        tags: input.tags ?? existing.tags,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date().toISOString(),
      }));
    },

    async delete(id) {
      return repo.delete(id);
    },
  };
}

// ─── Company Service ───────────────────────────────────────────────────────────

export interface CompanyService {
  list(): Promise<Company[]>;
  getById(id: string): Promise<Company | null>;
  create(input: CreateCompanyInput): Promise<Company>;
  update(id: string, input: Partial<CreateCompanyInput>): Promise<Company | null>;
  delete(id: string): Promise<boolean>;
}

export function createCompanyService(repo: CompanyRepository): CompanyService {
  return {
    async list() {
      return repo.list();
    },

    async getById(id) {
      return repo.getById(id);
    },

    async create(input) {
      const now = new Date().toISOString();
      const company: Company = {
        id: newId('company'),
        name: input.name,
        industry: input.industry,
        website: input.website,
        size: input.size,
        address: input.address,
        tags: input.tags ?? [],
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };
      await repo.save(company);
      return company;
    },

    async update(id, input) {
      return repo.update(id, (existing) => ({
        ...existing,
        name: input.name ?? existing.name,
        industry: input.industry ?? existing.industry,
        website: input.website ?? existing.website,
        size: input.size ?? existing.size,
        address: input.address ?? existing.address,
        tags: input.tags ?? existing.tags,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date().toISOString(),
      }));
    },

    async delete(id) {
      return repo.delete(id);
    },
  };
}

// ─── Deal Service ──────────────────────────────────────────────────────────────

export interface DealService {
  list(): Promise<Deal[]>;
  getById(id: string): Promise<Deal | null>;
  getWithRelations(id: string): Promise<DealWithRelations | null>;
  getByStage(stage: DealStage): Promise<Deal[]>;
  create(input: CreateDealInput): Promise<Deal>;
  updateStage(id: string, input: UpdateDealStageInput): Promise<Deal | null>;
  update(id: string, input: Partial<CreateDealInput>): Promise<Deal | null>;
  delete(id: string): Promise<boolean>;
}

export function createDealService(
  repo: DealRepository,
  contactRepo: ContactRepository,
  companyRepo: CompanyRepository
): DealService {
  return {
    async list() {
      return repo.list();
    },

    async getById(id) {
      return repo.getById(id);
    },

    async getWithRelations(id) {
      const deal = await repo.getById(id);
      if (!deal) return null;
      const contact = deal.contactId ? await contactRepo.getById(deal.contactId) ?? undefined : undefined;
      const company = deal.companyId ? await companyRepo.getById(deal.companyId) ?? undefined : undefined;
      return { ...deal, contact, company };
    },

    async getByStage(stage) {
      return repo.getByStage(stage);
    },

    async create(input) {
      const now = new Date().toISOString();
      const deal: Deal = {
        id: newId('deal'),
        title: input.title,
        value: input.value ?? 0,
        stage: input.stage ?? 'prospecting',
        contactId: input.contactId,
        companyId: input.companyId,
        expectedClose: input.expectedClose,
        description: input.description,
        createdAt: now,
        updatedAt: now,
      };
      await repo.save(deal);
      return deal;
    },

    async updateStage(id, input) {
      return repo.update(id, (existing) => ({
        ...existing,
        stage: input.stage,
        updatedAt: new Date().toISOString(),
      }));
    },

    async update(id, input) {
      return repo.update(id, (existing) => ({
        ...existing,
        title: input.title ?? existing.title,
        value: input.value ?? existing.value,
        stage: input.stage ?? existing.stage,
        contactId: input.contactId ?? existing.contactId,
        companyId: input.companyId ?? existing.companyId,
        expectedClose: input.expectedClose ?? existing.expectedClose,
        description: input.description ?? existing.description,
        updatedAt: new Date().toISOString(),
      }));
    },

    async delete(id) {
      return repo.delete(id);
    },
  };
}

// ─── Activity Service ─────────────────────────────────────────────────────────

export interface ActivityService {
  list(): Promise<Activity[]>;
  getById(id: string): Promise<Activity | null>;
  getByContactId(contactId: string): Promise<Activity[]>;
  getByCompanyId(companyId: string): Promise<Activity[]>;
  getByDealId(dealId: string): Promise<Activity[]>;
  create(input: CreateActivityInput): Promise<Activity>;
  delete(id: string): Promise<boolean>;
}

export function createActivityService(repo: ActivityRepository): ActivityService {
  return {
    async list() {
      return repo.list();
    },

    async getById(id) {
      return repo.getById(id);
    },

    async getByContactId(contactId) {
      return repo.getByContactId(contactId);
    },

    async getByCompanyId(companyId) {
      return repo.getByCompanyId(companyId);
    },

    async getByDealId(dealId) {
      return repo.getByDealId(dealId);
    },

    async create(input) {
      const activity: Activity = {
        id: newId('activity'),
        type: input.type,
        subject: input.subject,
        body: input.body,
        contactId: input.contactId,
        companyId: input.companyId,
        dealId: input.dealId,
        createdAt: new Date().toISOString(),
      };
      await repo.save(activity);
      return activity;
    },

    async delete(id) {
      return repo.delete(id);
    },
  };
}

// ─── Dashboard Service ─────────────────────────────────────────────────────────

export interface DashboardService {
  getDashboard(): Promise<CrmDashboardData>;
}

export function createDashboardService(
  contactRepo: ContactRepository,
  companyRepo: CompanyRepository,
  dealRepo: DealRepository,
  activityRepo: ActivityRepository
): DashboardService {
  return {
    async getDashboard() {
      const [contacts, companies, deals, activities] = await Promise.all([
        contactRepo.list(),
        companyRepo.list(),
        dealRepo.list(),
        activityRepo.list(),
      ]);

      const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

      const stageBreakdown: Record<DealStage, { count: number; value: number }> = {
        prospecting: { count: 0, value: 0 },
        qualification: { count: 0, value: 0 },
        proposal: { count: 0, value: 0 },
        negotiation: { count: 0, value: 0 },
        closed_won: { count: 0, value: 0 },
        closed_lost: { count: 0, value: 0 },
      };

      for (const deal of deals) {
        const b = stageBreakdown[deal.stage ?? 'prospecting'];
        b.count++;
        b.value += deal.value ?? 0;
      }

      // Recent activities: last 20 sorted by createdAt desc
      const recentActivities = [...activities]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);

      // Top deals: top 10 by value
      const topDeals = [...deals]
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 10);

      return {
        contactCount: contacts.length,
        companyCount: companies.length,
        dealCount: deals.length,
        totalPipelineValue,
        stageBreakdown,
        recentActivities,
        topDeals,
      };
    },
  };
}
