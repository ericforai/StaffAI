import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Contact, Company, Deal, Task, User, Role } from '../types';

const DATA_DIR = path.join(__dirname, '../../data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');
const DEALS_FILE = path.join(DATA_DIR, 'deals.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T[]): T[] {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function writeJson<T>(file: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface ContactRepository {
  list(): Contact[];
  getById(id: string): Contact | null;
  create(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Contact;
  update(id: string, patch: Partial<Omit<Contact, 'id' | 'createdAt'>>): Contact | null;
  delete(id: string): boolean;
}

export const contactRepository: ContactRepository = {
  list() {
    return readJson<Contact>(CONTACTS_FILE, []);
  },
  getById(id) {
    return this.list().find(c => c.id === id) ?? null;
  },
  create(fields) {
    const now = new Date().toISOString();
    const contact: Contact = { ...fields, id: uuidv4(), createdAt: now, updatedAt: now };
    const contacts = this.list();
    contacts.push(contact);
    writeJson(CONTACTS_FILE, contacts);
    return contact;
  },
  update(id, patch) {
    const contacts = this.list();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const updated = { ...contacts[idx], ...patch, updatedAt: new Date().toISOString() };
    contacts[idx] = updated;
    writeJson(CONTACTS_FILE, contacts);
    return updated;
  },
  delete(id) {
    const contacts = this.list();
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return false;
    contacts.splice(idx, 1);
    writeJson(CONTACTS_FILE, contacts);
    return true;
  },
};

// ─── Companies ────────────────────────────────────────────────────────────────

export interface CompanyRepository {
  list(): Company[];
  getById(id: string): Company | null;
  create(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Company;
  update(id: string, patch: Partial<Omit<Company, 'id' | 'createdAt'>>): Company | null;
  delete(id: string): boolean;
}

export const companyRepository: CompanyRepository = {
  list() {
    return readJson<Company>(COMPANIES_FILE, []);
  },
  getById(id) {
    return this.list().find(c => c.id === id) ?? null;
  },
  create(fields) {
    const now = new Date().toISOString();
    const company: Company = { ...fields, id: uuidv4(), createdAt: now, updatedAt: now };
    const companies = this.list();
    companies.push(company);
    writeJson(COMPANIES_FILE, companies);
    return company;
  },
  update(id, patch) {
    const companies = this.list();
    const idx = companies.findIndex(c => c.id === id);
    if (idx === -1) return null;
    const updated = { ...companies[idx], ...patch, updatedAt: new Date().toISOString() };
    companies[idx] = updated;
    writeJson(COMPANIES_FILE, companies);
    return updated;
  },
  delete(id) {
    const companies = this.list();
    const idx = companies.findIndex(c => c.id === id);
    if (idx === -1) return false;
    companies.splice(idx, 1);
    writeJson(COMPANIES_FILE, companies);
    return true;
  },
};

// ─── Deals ────────────────────────────────────────────────────────────────────

export interface DealRepository {
  list(): Deal[];
  getById(id: string): Deal | null;
  create(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Deal;
  update(id: string, patch: Partial<Omit<Deal, 'id' | 'createdAt'>>): Deal | null;
  delete(id: string): boolean;
}

export const dealRepository: DealRepository = {
  list() {
    return readJson<Deal>(DEALS_FILE, []);
  },
  getById(id) {
    return this.list().find(d => d.id === id) ?? null;
  },
  create(fields) {
    const now = new Date().toISOString();
    const deal: Deal = { ...fields, id: uuidv4(), createdAt: now, updatedAt: now };
    const deals = this.list();
    deals.push(deal);
    writeJson(DEALS_FILE, deals);
    return deal;
  },
  update(id, patch) {
    const deals = this.list();
    const idx = deals.findIndex(d => d.id === id);
    if (idx === -1) return null;
    const updated = { ...deals[idx], ...patch, updatedAt: new Date().toISOString() };
    deals[idx] = updated;
    writeJson(DEALS_FILE, deals);
    return updated;
  },
  delete(id) {
    const deals = this.list();
    const idx = deals.findIndex(d => d.id === id);
    if (idx === -1) return false;
    deals.splice(idx, 1);
    writeJson(DEALS_FILE, deals);
    return true;
  },
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskRepository {
  list(): Task[];
  getById(id: string): Task | null;
  create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task;
  update(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Task | null;
  delete(id: string): boolean;
}

export const taskRepository: TaskRepository = {
  list() {
    return readJson<Task>(TASKS_FILE, []);
  },
  getById(id) {
    return this.list().find(t => t.id === id) ?? null;
  },
  create(fields) {
    const now = new Date().toISOString();
    const task: Task = { ...fields, id: uuidv4(), createdAt: now, updatedAt: now };
    const tasks = this.list();
    tasks.push(task);
    writeJson(TASKS_FILE, tasks);
    return task;
  },
  update(id, patch) {
    const tasks = this.list();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const updated = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
    tasks[idx] = updated;
    writeJson(TASKS_FILE, tasks);
    return updated;
  },
  delete(id) {
    const tasks = this.list();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    tasks.splice(idx, 1);
    writeJson(TASKS_FILE, tasks);
    return true;
  },
};

// ─── Users ──────────────────────────────────────────────────────────────────────

export interface UserRepository {
  list(): User[];
  getById(id: string): User | null;
  getByEmail(email: string): User | null;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User;
  update(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): User | null;
  delete(id: string): boolean;
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');

export const userRepository: UserRepository = {
  list() {
    return readJson<User>(USERS_FILE, []);
  },
  getById(id) {
    return this.list().find(u => u.id === id) ?? null;
  },
  getByEmail(email) {
    return this.list().find(u => u.email === email) ?? null;
  },
  create(fields) {
    const now = new Date().toISOString();
    const user: User = { ...fields, id: uuidv4(), createdAt: now, updatedAt: now };
    const users = this.list();
    users.push(user);
    writeJson(USERS_FILE, users);
    return user;
  },
  update(id, patch) {
    const users = this.list();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    const updated = { ...users[idx], ...patch, updatedAt: new Date().toISOString() };
    users[idx] = updated;
    writeJson(USERS_FILE, users);
    return updated;
  },
  delete(id) {
    const users = this.list();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    writeJson(USERS_FILE, users);
    return true;
  },
};

// ─── Seed Demo Users ─────────────────────────────────────────────────────────────

export function seedUsers(): void {
  ensureDataDir();
  const existing = readJson<unknown>(USERS_FILE, []);
  if (existing.length === 0) {
    const now = new Date().toISOString();
    const seed: User[] = [
      { id: 'u-admin', email: 'admin@crm.dev', name: 'Admin User', role: 'admin' as Role, active: true, createdAt: now, updatedAt: now },
      { id: 'u-manager', email: 'manager@crm.dev', name: 'Sales Manager', role: 'manager' as Role, active: true, createdAt: now, updatedAt: now },
      { id: 'u-sales', email: 'sales@crm.dev', name: 'Sales Rep', role: 'sales' as Role, active: true, createdAt: now, updatedAt: now },
      { id: 'u-readonly', email: 'viewer@crm.dev', name: 'Viewer', role: 'readonly' as Role, active: true, createdAt: now, updatedAt: now },
    ];
    writeJson(USERS_FILE, seed);
    console.log('[CRM] Demo users seeded: admin@crm.dev | manager@crm.dev | sales@crm.dev | viewer@crm.dev');
  }
}
