import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { EliteSkill, EliteSkillFile, EliteSkillStatus } from '../types';

const ELITE_SKILLS_DIR = 'elite-skills';

function getEliteSkillsDir(): string {
  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  return path.join(agencyHome, ELITE_SKILLS_DIR, 'skills');
}

function getRegistryPath(): string {
  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  return path.join(agencyHome, ELITE_SKILLS_DIR, 'registry.json');
}

// Registry record (simplified, content loaded separately)
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

interface Registry {
  version: number;
  skills: EliteSkillRegistryRecord[];
}

/**
 * 列出所有已发布技能
 */
export async function listPublishedSkills(): Promise<EliteSkillRegistryRecord[]> {
  const registry = await loadRegistry();
  return registry.skills.filter(s => s.status === 'published');
}

/**
 * 获取所有技能（含所有状态）
 */
export async function listAllSkills(): Promise<EliteSkillRegistryRecord[]> {
  const registry = await loadRegistry();
  return registry.skills;
}

/**
 * 根据 ID 获取技能元数据
 */
export async function getSkillById(id: string): Promise<EliteSkillRegistryRecord | null> {
  const registry = await loadRegistry();
  return registry.skills.find(s => s.id === id) || null;
}

/**
 * 获取技能文件内容
 */
export async function getSkillContent(id: string): Promise<string | null> {
  const skill = await getSkillById(id);
  if (!skill) return null;

  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  const contentPath = path.join(agencyHome, skill.filePath);

  try {
    return await fs.readFile(contentPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 获取技能完整信息（含内容）
 */
export async function getSkillFile(id: string): Promise<EliteSkillFile | null> {
  const skill = await getSkillById(id);
  if (!skill) return null;

  const content = await getSkillContent(id);
  if (!content) return null;

  return { skill, content };
}

/**
 * 创建新技能
 */
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

  const skillDir = path.join(getEliteSkillsDir(), id);
  await fs.mkdir(skillDir, { recursive: true });

  // Write SKILL.md
  const skillFilePath = path.join(skillDir, 'SKILL.md');
  const fileContent = matter.stringify(input.content, {
    name: input.name,
    description: input.description,
    version: input.version || '1.0.0',
    expert: input.expert,
    category: input.category,
    tags: input.tags,
    createdBy: input.createdBy,
    createdAt: now,
  });
  await fs.writeFile(skillFilePath, fileContent, 'utf-8');

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
    filePath: path.join(ELITE_SKILLS_DIR, 'skills', id, 'SKILL.md'),
  };

  const registry = await loadRegistry();
  registry.skills.push(record);
  await saveRegistry(registry);

  return record;
}

/**
 * 更新技能
 */
export async function updateSkill(
  id: string,
  updates: Partial<Omit<EliteSkillRegistryRecord, 'id' | 'createdAt' | 'createdBy' | 'filePath'>>
): Promise<EliteSkillRegistryRecord | null> {
  const registry = await loadRegistry();
  const index = registry.skills.findIndex(s => s.id === id);
  if (index === -1) return null;

  const updated: EliteSkillRegistryRecord = {
    ...registry.skills[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  registry.skills[index] = updated;
  await saveRegistry(registry);

  return updated;
}

/**
 * 删除技能
 */
export async function deleteSkill(id: string): Promise<boolean> {
  const registry = await loadRegistry();
  const index = registry.skills.findIndex(s => s.id === id);
  if (index === -1) return false;

  const skill = registry.skills[index];
  const agencyHome = process.env.AGENCY_HOME || process.cwd();
  const skillDir = path.join(agencyHome, ELITE_SKILLS_DIR, 'skills', id);

  try {
    await fs.rm(skillDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }

  registry.skills.splice(index, 1);
  await saveRegistry(registry);

  return true;
}

/**
 * 发布技能
 */
export async function publishSkill(id: string): Promise<EliteSkillRegistryRecord | null> {
  return updateSkill(id, { status: 'published' });
}

/**
 * 下架技能
 */
export async function deprecateSkill(id: string): Promise<EliteSkillRegistryRecord | null> {
  return updateSkill(id, { status: 'deprecated' });
}

// Helper functions

function generateSkillId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
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
