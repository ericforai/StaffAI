import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { EliteSkillFile, EliteSkillStatus } from '../types';

const ELITE_SKILLS_DIR = 'elite-skills';

function getEliteSkillsDir(): string {
  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  return path.join(agencyHome, ELITE_SKILLS_DIR, 'skills');
}

function getRegistryPath(): string {
  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  return path.join(agencyHome, ELITE_SKILLS_DIR, 'registry.json');
}

function getSkillContentPath(filePath: string): string {
  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  return path.join(agencyHome, filePath);
}

function getSkillDirectory(id: string): string {
  return path.join(getEliteSkillsDir(), id);
}

export interface EliteSkillRegistryRecord {
  id: string;
  name: string;
  description: string;
  version?: string;
  expert: { name: string; department: string; title: string };
  category: string;
  tags: string[];
  status: EliteSkillStatus;
  installCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  filePath: string;
}

export interface UpdateEliteSkillInput {
  name?: string;
  description?: string;
  version?: string;
  expert?: { name: string; department: string; title: string };
  category?: string;
  tags?: string[];
  status?: EliteSkillStatus;
  installCount?: number;
  content?: string;
}

interface Registry {
  version: number;
  skills: EliteSkillRegistryRecord[];
}

export async function listPublishedSkills(): Promise<EliteSkillRegistryRecord[]> {
  const registry = await loadRegistry();
  return registry.skills.filter((skill) => skill.status === 'published');
}

export async function listAllSkills(): Promise<EliteSkillRegistryRecord[]> {
  const registry = await loadRegistry();
  return registry.skills;
}

export async function getSkillById(id: string): Promise<EliteSkillRegistryRecord | null> {
  if (!isValidSkillId(id)) {
    return null;
  }
  const registry = await loadRegistry();
  return registry.skills.find((skill) => skill.id === id) || null;
}

export async function getSkillContent(id: string): Promise<string | null> {
  if (!isValidSkillId(id)) {
    return null;
  }
  const skill = await getSkillById(id);
  if (!skill) return null;

  try {
    return await fs.readFile(getSkillContentPath(skill.filePath), 'utf-8');
  } catch {
    return null;
  }
}

export async function getSkillFile(id: string): Promise<EliteSkillFile | null> {
  if (!isValidSkillId(id)) {
    return null;
  }
  const skill = await getSkillById(id);
  if (!skill) return null;

  const content = await getSkillContent(id);
  if (!content) return null;

  return { skill, content };
}

export async function createSkill(input: {
  name: string;
  description: string;
  version?: string;
  expert: { name: string; department: string; title: string };
  category: string;
  tags: string[];
  content: string;
  createdBy: string;
}): Promise<EliteSkillRegistryRecord> {
  const id = generateSkillId(input.name);
  const now = new Date().toISOString();

  const record: EliteSkillRegistryRecord = {
    id,
    name: input.name,
    description: input.description,
    version: input.version || '1.0.0',
    expert: input.expert,
    category: input.category,
    tags: input.tags,
    status: 'pending',
    installCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    filePath: path.join('elite-skills', 'skills', id, 'SKILL.md'),
  };

  await writeSkillFile(record, input.content);

  const registry = await loadRegistry();
  registry.skills.push(record);
  await saveRegistry(registry);

  return record;
}

export async function updateSkill(
  id: string,
  updates: UpdateEliteSkillInput,
): Promise<EliteSkillRegistryRecord | null> {
  if (!isValidSkillId(id)) {
    return null;
  }
  const registry = await loadRegistry();
  const index = registry.skills.findIndex((skill) => skill.id === id);
  if (index === -1) return null;

  const existing = registry.skills[index];
  const existingContent = await getSkillContent(id);
  const updated: EliteSkillRegistryRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  registry.skills[index] = updated;
  await writeSkillFile(updated, updates.content ?? extractBody(existingContent) ?? '');
  await saveRegistry(registry);

  return updated;
}

export async function deleteSkill(id: string): Promise<boolean> {
  if (!isValidSkillId(id)) {
    return false;
  }
  const registry = await loadRegistry();
  const index = registry.skills.findIndex((skill) => skill.id === id);
  if (index === -1) return false;

  const skill = registry.skills[index];
  const skillDir = getSkillDirectory(id);

  try {
    await fs.rm(skillDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }

  registry.skills.splice(index, 1);
  await saveRegistry(registry);

  return true;
}

export async function publishSkill(id: string): Promise<EliteSkillRegistryRecord | null> {
  return updateSkill(id, { status: 'published' });
}

export async function deprecateSkill(id: string): Promise<EliteSkillRegistryRecord | null> {
  return updateSkill(id, { status: 'deprecated' });
}

function generateSkillId(name: string): string {
  const normalized = name.toLowerCase().trim();
  let result = '';

  for (const char of normalized) {
    if (/[a-zA-Z0-9\u4e00-\u9fa5-]/.test(char) || char === ' ') {
      result += char === ' ' ? '-' : char;
    }
  }

  while (result.includes('--')) {
    result = result.replace('--', '-');
  }

  while (result.startsWith('-')) {
    result = result.slice(1);
  }
  while (result.endsWith('-')) {
    result = result.slice(0, -1);
  }

  return result;
}

function isValidSkillId(id: string): boolean {
  return /^[a-z0-9\u4e00-\u9fa5-]+$/.test(id);
}

function extractBody(content: string | null): string | null {
  if (!content) {
    return null;
  }

  return matter(content).content;
}

async function writeSkillFile(record: EliteSkillRegistryRecord, content: string): Promise<void> {
  const contentPath = getSkillContentPath(record.filePath);

  let existingFrontmatter: Record<string, unknown> = {};
  try {
    existingFrontmatter = matter(await fs.readFile(contentPath, 'utf-8')).data;
  } catch {
    existingFrontmatter = {};
  }

  const fileContent = matter.stringify(content, {
    ...existingFrontmatter,
    name: record.name,
    description: record.description,
    version: record.version || '1.0.0',
    expert: record.expert,
    category: record.category,
    tags: record.tags,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

  await fs.mkdir(path.dirname(contentPath), { recursive: true });
  await fs.writeFile(contentPath, fileContent, 'utf-8');
}

async function loadRegistry(): Promise<Registry> {
  const registryPath = getRegistryPath();

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    return JSON.parse(content) as Registry;
  } catch {
    return { version: 1, skills: [] };
  }
}

async function saveRegistry(registry: Registry): Promise<void> {
  const registryPath = getRegistryPath();
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}
