import fs from 'node:fs';
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
} from '../types/crm-types';

// ─── JSON File Helpers ────────────────────────────────────────────────────────

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Contact Repository ───────────────────────────────────────────────────────

export function createFileContactRepository(filePath: string): ContactRepository {
  return {
    async list() {
      return readJsonFile<Contact[]>(filePath, []);
    },
    async getById(id) {
      return (await this.list()).find((c) => c.id === id) || null;
    },
    async getByCompanyId(companyId) {
      return (await this.list()).filter((c) => c.companyId === companyId);
    },
    async save(contact) {
      const contacts = await this.list();
      const index = contacts.findIndex((c) => c.id === contact.id);
      if (index >= 0) {
        contacts[index] = contact;
      } else {
        contacts.push(contact);
      }
      writeJsonFile(filePath, contacts);
    },
    async update(id, updater) {
      const contacts = await this.list();
      const index = contacts.findIndex((c) => c.id === id);
      if (index < 0) return null;
      const updated = updater(contacts[index]);
      contacts[index] = updated;
      writeJsonFile(filePath, contacts);
      return updated;
    },
    async delete(id) {
      const contacts = await this.list();
      const filtered = contacts.filter((c) => c.id !== id);
      if (filtered.length === contacts.length) return false;
      writeJsonFile(filePath, filtered);
      return true;
    },
  };
}

export function createInMemoryContactRepository(seed: Contact[] = []): ContactRepository {
  const contacts = [...seed];
  return {
    async list() {
      return [...contacts];
    },
    async getById(id) {
      return contacts.find((c) => c.id === id) || null;
    },
    async getByCompanyId(companyId) {
      return contacts.filter((c) => c.companyId === companyId);
    },
    async save(contact) {
      const index = contacts.findIndex((c) => c.id === contact.id);
      if (index >= 0) {
        contacts[index] = contact;
      } else {
        contacts.push(contact);
      }
    },
    async update(id, updater) {
      const index = contacts.findIndex((c) => c.id === id);
      if (index < 0) return null;
      contacts[index] = updater(contacts[index]);
      return contacts[index];
    },
    async delete(id) {
      const index = contacts.findIndex((c) => c.id === id);
      if (index < 0) return false;
      contacts.splice(index, 1);
      return true;
    },
  };
}

// ─── Company Repository ────────────────────────────────────────────────────────

export function createFileCompanyRepository(filePath: string): CompanyRepository {
  return {
    async list() {
      return readJsonFile<Company[]>(filePath, []);
    },
    async getById(id) {
      return (await this.list()).find((c) => c.id === id) || null;
    },
    async save(company) {
      const companies = await this.list();
      const index = companies.findIndex((c) => c.id === company.id);
      if (index >= 0) {
        companies[index] = company;
      } else {
        companies.push(company);
      }
      writeJsonFile(filePath, companies);
    },
    async update(id, updater) {
      const companies = await this.list();
      const index = companies.findIndex((c) => c.id === id);
      if (index < 0) return null;
      const updated = updater(companies[index]);
      companies[index] = updated;
      writeJsonFile(filePath, companies);
      return updated;
    },
    async delete(id) {
      const companies = await this.list();
      const filtered = companies.filter((c) => c.id !== id);
      if (filtered.length === companies.length) return false;
      writeJsonFile(filePath, filtered);
      return true;
    },
  };
}

export function createInMemoryCompanyRepository(seed: Company[] = []): CompanyRepository {
  const companies = [...seed];
  return {
    async list() {
      return [...companies];
    },
    async getById(id) {
      return companies.find((c) => c.id === id) || null;
    },
    async save(company) {
      const index = companies.findIndex((c) => c.id === company.id);
      if (index >= 0) {
        companies[index] = company;
      } else {
        companies.push(company);
      }
    },
    async update(id, updater) {
      const index = companies.findIndex((c) => c.id === id);
      if (index < 0) return null;
      companies[index] = updater(companies[index]);
      return companies[index];
    },
    async delete(id) {
      const index = companies.findIndex((c) => c.id === id);
      if (index < 0) return false;
      companies.splice(index, 1);
      return true;
    },
  };
}

// ─── Deal Repository ───────────────────────────────────────────────────────────

export function createFileDealRepository(filePath: string): DealRepository {
  return {
    async list() {
      return readJsonFile<Deal[]>(filePath, []);
    },
    async getById(id) {
      return (await this.list()).find((d) => d.id === id) || null;
    },
    async getByStage(stage) {
      return (await this.list()).filter((d) => d.stage === stage);
    },
    async save(deal) {
      const deals = await this.list();
      const index = deals.findIndex((d) => d.id === deal.id);
      if (index >= 0) {
        deals[index] = deal;
      } else {
        deals.push(deal);
      }
      writeJsonFile(filePath, deals);
    },
    async update(id, updater) {
      const deals = await this.list();
      const index = deals.findIndex((d) => d.id === id);
      if (index < 0) return null;
      const updated = updater(deals[index]);
      deals[index] = updated;
      writeJsonFile(filePath, deals);
      return updated;
    },
    async delete(id) {
      const deals = await this.list();
      const filtered = deals.filter((d) => d.id !== id);
      if (filtered.length === deals.length) return false;
      writeJsonFile(filePath, filtered);
      return true;
    },
  };
}

export function createInMemoryDealRepository(seed: Deal[] = []): DealRepository {
  const deals = [...seed];
  return {
    async list() {
      return [...deals];
    },
    async getById(id) {
      return deals.find((d) => d.id === id) || null;
    },
    async getByStage(stage) {
      return deals.filter((d) => d.stage === stage);
    },
    async save(deal) {
      const index = deals.findIndex((d) => d.id === deal.id);
      if (index >= 0) {
        deals[index] = deal;
      } else {
        deals.push(deal);
      }
    },
    async update(id, updater) {
      const index = deals.findIndex((d) => d.id === id);
      if (index < 0) return null;
      deals[index] = updater(deals[index]);
      return deals[index];
    },
    async delete(id) {
      const index = deals.findIndex((d) => d.id === id);
      if (index < 0) return false;
      deals.splice(index, 1);
      return true;
    },
  };
}

// ─── Activity Repository ──────────────────────────────────────────────────────

export function createFileActivityRepository(filePath: string): ActivityRepository {
  return {
    async list() {
      return readJsonFile<Activity[]>(filePath, []);
    },
    async getById(id) {
      return (await this.list()).find((a) => a.id === id) || null;
    },
    async getByContactId(contactId) {
      return (await this.list()).filter((a) => a.contactId === contactId);
    },
    async getByCompanyId(companyId) {
      return (await this.list()).filter((a) => a.companyId === companyId);
    },
    async getByDealId(dealId) {
      return (await this.list()).filter((a) => a.dealId === dealId);
    },
    async save(activity) {
      const activities = await this.list();
      activities.push(activity);
      writeJsonFile(filePath, activities);
    },
    async delete(id) {
      const activities = await this.list();
      const filtered = activities.filter((a) => a.id !== id);
      if (filtered.length === activities.length) return false;
      writeJsonFile(filePath, filtered);
      return true;
    },
  };
}

export function createInMemoryActivityRepository(seed: Activity[] = []): ActivityRepository {
  const activities = [...seed];
  return {
    async list() {
      return [...activities];
    },
    async getById(id) {
      return activities.find((a) => a.id === id) || null;
    },
    async getByContactId(contactId) {
      return activities.filter((a) => a.contactId === contactId);
    },
    async getByCompanyId(companyId) {
      return activities.filter((a) => a.companyId === companyId);
    },
    async getByDealId(dealId) {
      return activities.filter((a) => a.dealId === dealId);
    },
    async save(activity) {
      activities.push(activity);
    },
    async delete(id) {
      const index = activities.findIndex((a) => a.id === id);
      if (index < 0) return false;
      activities.splice(index, 1);
      return true;
    },
  };
}
