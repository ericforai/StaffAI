# 精英克隆模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现精英克隆模块 - 让用户通过 Web 界面浏览、咨询公司专家沉淀的 Skills

**Architecture:**
- 后端：新增 `/api/elite/` 路由，文件存储 Skills 内容，复用 StaffAI 现有权限系统
- 前端：新增 `/app/elite/` 页面，使用 StaffAI 现有 UI 组件和样式
- 咨询功能：后端读取 SKILL.md 内容，注入 AI 对话上下文

**Tech Stack:** TypeScript + Express + Next.js + Tailwind CSS + Lucide Icons

---

## 文件结构

```
hq/backend/src/
├── api/elite.ts                          # 精英克隆 API 路由 (新建)
├── persistence/elite-repositories.ts      # Skills 文件存储 (新建)
├── types.ts                              # 新增 EliteSkill 类型 (修改)

hq/frontend/src/
├── app/elite/                            # 精英克隆页面目录 (新建)
│   ├── page.tsx                          # 技能列表页
│   ├── [skillId]/
│   │   └── page.tsx                      # 技能详情页
│   └── [skillId]/chat/
│       └── page.tsx                      # 咨询对话框页
├── hooks/useEliteSkills.ts               # Skills 数据 Hook (新建)
└── components/elite/                     # 精英克隆组件 (新建)
    ├── SkillCard.tsx
    ├── SkillDetail.tsx
    └── ChatDialog.tsx
```

---

## Task 1: 后端 - 定义 EliteSkill 类型

**Files:**
- Modify: `hq/backend/src/types.ts`

- [ ] **Step 1: 添加 EliteSkill 类型定义**

在 `types.ts` 末尾添加：

```typescript
// ─────────────────────────────────────────────
// Elite Clone Domain Types
// ─────────────────────────────────────────────

export type EliteSkillStatus = 'pending' | 'published' | 'deprecated';

export interface EliteSkillExpert {
  name: string;
  department: string;
  title: string;
}

export interface EliteSkill {
  id: string;                   // slug, e.g., 'xiakaifu-sales'
  name: string;                // 技能名称
  description: string;         // 一句话描述
  version: string;              // 版本号, e.g., '1.0.0'
  expert: EliteSkillExpert;
  category: string;             // 分类: sales/marketing/engineering/design/product/support
  tags: string[];
  status: EliteSkillStatus;
  installCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;           // 创建人 (admin user id)
}

export interface EliteSkillFile {
  skill: EliteSkill;
  content: string;             // SKILL.md 完整内容
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/backend/src/types.ts
git commit -m "feat(elite): add EliteSkill types"
```

---

## Task 2: 后端 - 实现文件仓储层

**Files:**
- Create: `hq/backend/src/persistence/elite-repositories.ts`

- [ ] **Step 1: 创建文件仓储实现**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
  const skillDir = path.join(agencyHome, path.dirname(skill.filePath));

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
```

- [ ] **Step 2: Commit**

```bash
git add hq/backend/src/persistence/elite-repositories.ts
git commit -m "feat(elite): add file-based skill repository"
```

---

## Task 3: 后端 - 实现 API 路由

**Files:**
- Create: `hq/backend/src/api/elite.ts`

- [ ] **Step 1: 创建 API 路由**

```typescript
/**
 * Elite Clone API Routes
 *
 * REST API for elite skill management and consultation
 *
 * Endpoints:
 * - GET    /api/elite/skills           - List published skills
 * - GET    /api/elite/skills/all       - List all skills (admin)
 * - GET    /api/elite/skills/:id       - Get skill details
 * - GET    /api/elite/skills/:id/content - Get SKILL.md content
 * - POST   /api/elite/skills           - Create skill (admin)
 * - PUT    /api/elite/skills/:id       - Update skill (admin)
 * - DELETE /api/elite/skills/:id       - Delete skill (admin)
 * - POST   /api/elite/skills/:id/publish - Publish skill (admin)
 * - POST   /api/elite/skills/:id/deprecate - Deprecate skill (admin)
 * - POST   /api/elite/skills/:id/consult - Consult skill (AI)
 */

import type { Router } from 'express';
import { z } from 'zod';
import * as eliteRepo from '../persistence/elite-repositories';
import type { Store } from '../store';

interface EliteRouteDependencies {
  store: Store;
}

// Validation schemas
const createSkillSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().optional(),
  expert: z.object({
    name: z.string(),
    department: z.string(),
    title: z.string(),
  }),
  category: z.string(),
  tags: z.array(z.string()),
  content: z.string(),
});

const updateSkillSchema = createSkillSchema.partial();

const consultSchema = z.object({
  question: z.string().min(1),
});

export function registerEliteRoutes(app: Router, deps: EliteRouteDependencies) {
  const { store } = deps;

  /**
   * GET /api/elite/skills
   * List published skills (public)
   */
  app.get('/api/elite/skills', async (_req, res) => {
    try {
      const skills = await eliteRepo.listPublishedSkills();
      return res.json({ skills, total: skills.length });
    } catch (error) {
      console.error('List elite skills error:', error);
      return res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  /**
   * GET /api/elite/skills/all
   * List all skills (admin only)
   */
  app.get('/api/elite/skills/all', async (_req, res) => {
    try {
      const skills = await eliteRepo.listAllSkills();
      return res.json({ skills, total: skills.length });
    } catch (error) {
      console.error('List all elite skills error:', error);
      return res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  /**
   * GET /api/elite/skills/:id
   * Get skill details
   */
  app.get('/api/elite/skills/:id', async (req, res) => {
    try {
      const skill = await eliteRepo.getSkillById(req.params.id);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ skill });
    } catch (error) {
      console.error('Get elite skill error:', error);
      return res.status(500).json({ error: 'Failed to get skill' });
    }
  });

  /**
   * GET /api/elite/skills/:id/content
   * Get skill SKILL.md content
   */
  app.get('/api/elite/skills/:id/content', async (req, res) => {
    try {
      const skillFile = await eliteRepo.getSkillFile(req.params.id);
      if (!skillFile) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ content: skillFile.content });
    } catch (error) {
      console.error('Get skill content error:', error);
      return res.status(500).json({ error: 'Failed to get skill content' });
    }
  });

  /**
   * POST /api/elite/skills
   * Create new skill (admin only)
   */
  app.post('/api/elite/skills', async (req, res) => {
    const validation = createSkillSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid skill data', details: validation.error.issues });
    }

    try {
      // TODO: Check admin permission
      const adminUserId = req.headers['x-user-id'] as string || 'admin';

      const skill = await eliteRepo.createSkill({
        ...validation.data,
        createdBy: adminUserId,
      });

      return res.status(201).json({ skill });
    } catch (error) {
      console.error('Create elite skill error:', error);
      return res.status(500).json({ error: 'Failed to create skill' });
    }
  });

  /**
   * PUT /api/elite/skills/:id
   * Update skill (admin only)
   */
  app.put('/api/elite/skills/:id', async (req, res) => {
    const validation = updateSkillSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid skill data', details: validation.error.issues });
    }

    try {
      const skill = await eliteRepo.updateSkill(req.params.id, validation.data);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ skill });
    } catch (error) {
      console.error('Update elite skill error:', error);
      return res.status(500).json({ error: 'Failed to update skill' });
    }
  });

  /**
   * DELETE /api/elite/skills/:id
   * Delete skill (admin only)
   */
  app.delete('/api/elite/skills/:id', async (req, res) => {
    try {
      const deleted = await eliteRepo.deleteSkill(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Delete elite skill error:', error);
      return res.status(500).json({ error: 'Failed to delete skill' });
    }
  });

  /**
   * POST /api/elite/skills/:id/publish
   * Publish skill (admin only)
   */
  app.post('/api/elite/skills/:id/publish', async (req, res) => {
    try {
      const skill = await eliteRepo.publishSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ skill });
    } catch (error) {
      console.error('Publish elite skill error:', error);
      return res.status(500).json({ error: 'Failed to publish skill' });
    }
  });

  /**
   * POST /api/elite/skills/:id/deprecate
   * Deprecate skill (admin only)
   */
  app.post('/api/elite/skills/:id/deprecate', async (req, res) => {
    try {
      const skill = await eliteRepo.deprecateSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ skill });
    } catch (error) {
      console.error('Deprecate elite skill error:', error);
      return res.status(500).json({ error: 'Failed to deprecate skill' });
    }
  });

  /**
   * POST /api/elite/skills/:id/consult
   * Consult skill using AI
   */
  app.post('/api/elite/skills/:id/consult', async (req, res) => {
    const validation = consultSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid question', details: validation.error.issues });
    }

    try {
      const skillFile = await eliteRepo.getSkillFile(req.params.id);
      if (!skillFile) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      if (skillFile.skill.status !== 'published') {
        return res.status(403).json({ error: 'Skill not available' });
      }

      // TODO: Integrate with AI consultation
      // For now, return a placeholder response
      const answer = `基于「${skillFile.skill.name}」的内容，我来回答您的问题：\n\n${validation.data.question}\n\n[AI 回复内容将在这里生成，基于 skillFile.content 注入上下文]`;

      return res.json({
        answer,
        skillId: req.params.id,
        skillName: skillFile.skill.name,
      });
    } catch (error) {
      console.error('Consult elite skill error:', error);
      return res.status(500).json({ error: 'Failed to consult skill' });
    }
  });
}
```

- [ ] **Step 2: 注册路由**

在 `hq/backend/src/app/register-backend-routes.ts` 中：

1. 添加 import:
```typescript
import { registerEliteRoutes } from '../api/elite';
```

2. 在 `registerBackendRoutes` 函数中添加:
```typescript
// Register elite clone routes
registerEliteRoutes(app, { store });
```

- [ ] **Step 3: Commit**

```bash
git add hq/backend/src/api/elite.ts hq/backend/src/app/register-backend-routes.ts
git commit -m "feat(elite): add Elite API routes"
```

---

## Task 4: 前端 - API Client 添加 elite 接口

**Files:**
- Modify: `hq/frontend/src/lib/api-client.ts`

- [ ] **Step 1: 添加 Elite API 方法**

在 `api-client.ts` 末尾添加：

```typescript
// Elite Clone APIs
export async function getEliteSkills(): Promise<EliteSkill[]> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills`);
  if (!response.ok) throw new Error('Failed to fetch elite skills');
  const data = await response.json();
  return data.skills;
}

export async function getAllEliteSkills(): Promise<EliteSkill[]> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/all`);
  if (!response.ok) throw new Error('Failed to fetch all elite skills');
  const data = await response.json();
  return data.skills;
}

export async function getEliteSkill(id: string): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}`);
  if (!response.ok) throw new Error('Failed to fetch elite skill');
  const data = await response.json();
  return data.skill;
}

export async function getEliteSkillContent(id: string): Promise<string> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}/content`);
  if (!response.ok) throw new Error('Failed to fetch skill content');
  const data = await response.json();
  return data.content;
}

export async function createEliteSkill(input: CreateSkillInput): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create elite skill');
  const data = await response.json();
  return data.skill;
}

export async function updateEliteSkill(id: string, input: Partial<CreateSkillInput>): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update elite skill');
  const data = await response.json();
  return data.skill;
}

export async function deleteEliteSkill(id: string): Promise<void> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete elite skill');
}

export async function publishEliteSkill(id: string): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}/publish`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to publish elite skill');
  const data = await response.json();
  return data.skill;
}

export async function deprecateEliteSkill(id: string): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}/deprecate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to deprecate elite skill');
  const data = await response.json();
  return data.skill;
}

export async function consultEliteSkill(id: string, question: string): Promise<ConsultResponse> {
  const response = await fetch(`${API_CONFIG.baseUrl}/elite/skills/${id}/consult`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error('Failed to consult elite skill');
  return response.json();
}

// Types
export interface EliteSkill {
  id: string;
  name: string;
  description: string;
  version?: string;
  expert: { name: string; department: string; title: string };
  category: string;
  tags: string[];
  status: 'pending' | 'published' | 'deprecated';
  installCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  version?: string;
  expert: { name: string; department: string; title: string };
  category: string;
  tags: string[];
  content: string;
}

export interface ConsultResponse {
  answer: string;
  skillId: string;
  skillName: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/frontend/src/lib/api-client.ts
git commit -m "feat(elite): add Elite API client methods"
```

---

## Task 5: 前端 - 实现 Skills Hook

**Files:**
- Create: `hq/frontend/src/hooks/useEliteSkills.ts`

- [ ] **Step 1: 创建 useEliteSkills Hook**

```typescript
/**
 * Elite Skills Hook
 */
import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api-client';
import type { EliteSkill, CreateSkillInput } from '../lib/api-client';

export function useEliteSkills() {
  const [skills, setSkills] = useState<EliteSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getEliteSkills();
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const createSkill = useCallback(async (input: CreateSkillInput) => {
    const skill = await api.createEliteSkill(input);
    setSkills(prev => [...prev, skill]);
    return skill;
  }, []);

  const updateSkill = useCallback(async (id: string, input: Partial<CreateSkillInput>) => {
    const updated = await api.updateEliteSkill(id, input);
    setSkills(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  const deleteSkill = useCallback(async (id: string) => {
    await api.deleteEliteSkill(id);
    setSkills(prev => prev.filter(s => s.id !== id));
  }, []);

  const publishSkill = useCallback(async (id: string) => {
    const updated = await api.publishEliteSkill(id);
    setSkills(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  const deprecateSkill = useCallback(async (id: string) => {
    const updated = await api.deprecateEliteSkill(id);
    setSkills(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  return {
    skills,
    loading,
    error,
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    publishSkill,
    deprecateSkill,
  };
}

export function useEliteSkill(skillId: string) {
  const [skill, setSkill] = useState<EliteSkill | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkill = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [skillData, contentData] = await Promise.all([
        api.getEliteSkill(skillId),
        api.getEliteSkillContent(skillId),
      ]);
      setSkill(skillData);
      setContent(contentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetchSkill();
  }, [fetchSkill]);

  return { skill, content, loading, error, refetch: fetchSkill };
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/frontend/src/hooks/useEliteSkills.ts
git commit -m "feat(elite): add useEliteSkills hook"
```

---

## Task 6: 前端 - 技能列表页

**Files:**
- Create: `hq/frontend/src/app/elite/page.tsx`

- [ ] **Step 1: 创建技能列表页**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Settings, Sparkles } from 'lucide-react';
import { useEliteSkills } from '../../hooks/useEliteSkills';
import type { EliteSkill } from '../../lib/api-client';

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'sales', label: '销售' },
  { key: 'marketing', label: '营销' },
  { key: 'engineering', label: '工程' },
  { key: 'design', label: '设计' },
  { key: 'product', label: '产品' },
  { key: 'support', label: '客服' },
];

const CATEGORY_COLORS: Record<string, string> = {
  sales: 'from-blue-500 to-blue-600',
  marketing: 'from-pink-500 to-rose-500',
  engineering: 'from-cyan-500 to-teal-500',
  design: 'from-purple-500 to-violet-500',
  product: 'from-amber-500 to-orange-500',
  support: 'from-emerald-500 to-green-500',
};

function SkillCard({ skill }: { skill: EliteSkill }) {
  const colorClass = CATEGORY_COLORS[skill.category] || 'from-gray-500 to-gray-600';

  return (
    <Link href={`/elite/${skill.id}`} className="block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
        <div className={`h-32 bg-gradient-to-br ${colorClass} relative`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">🎯</span>
            </div>
          </div>
          <div className="absolute bottom-3 left-4 text-white/80 text-sm">
            {skill.expert.name} · {skill.expert.department}
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
            {skill.name}
          </h3>
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {skill.description}
          </p>
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              skill.status === 'published'
                ? 'bg-emerald-50 text-emerald-600'
                : skill.status === 'pending'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-gray-50 text-gray-500'
            }`}>
              {skill.status === 'published' ? '已发布' : skill.status === 'pending' ? '待审核' : '已下架'}
            </span>
            <span className="text-xs text-gray-400">
              v{skill.version || '1.0.0'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ElitePage() {
  const { skills, loading, error } = useEliteSkills();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(search.toLowerCase()) ||
      skill.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || skill.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                精英克隆
              </h1>
              <p className="text-gray-500 mt-1">
                浏览公司专家沉淀的 Skills，AI 咨询即刻上手
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/elite/admin"
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                管理
              </Link>
              <Link
                href="/elite/admin"
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                上传技能
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索技能..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  category === cat.key
                    ? 'bg-purple-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Skills Grid */}
        {!loading && !error && (
          <>
            {filteredSkills.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无技能</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredSkills.map(skill => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/frontend/src/app/elite/page.tsx
git commit -m "feat(elite): add skill list page"
```

---

## Task 7: 前端 - 技能详情页

**Files:**
- Create: `hq/frontend/src/app/elite/[skillId]/page.tsx`

- [ ] **Step 1: 创建技能详情页**

```tsx
'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, FileText, User, Clock, Download, Sparkles } from 'lucide-react';
import { useEliteSkill } from '../../../hooks/useEliteSkills';

export default function SkillDetailPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const { skill, content, loading, error } = useEliteSkill(skillId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{error || '技能不存在'}</p>
          <Link href="/elite" className="text-purple-500 hover:underline mt-4 inline-block">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href="/elite"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回技能广场
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero */}
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                  🎯
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-2">{skill.name}</h1>
                  <p className="text-white/80">{skill.description}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">技能介绍</h2>
              <p className="text-gray-600 leading-relaxed">
                {skill.description}
              </p>
            </div>

            {/* Content Preview */}
            {content && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">技能内容</h2>
                  <button className="text-purple-500 hover:text-purple-600 flex items-center gap-1 text-sm">
                    <FileText className="w-4 h-4" />
                    查看完整内容
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                  {content.slice(0, 2000)}
                  {content.length > 2000 && '...'}
                </div>
              </div>
            )}

            {/* Expert Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">专家信息</h2>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center text-white text-xl">
                  {skill.expert.name[0]}
                </div>
                <div>
                  <div className="font-semibold">{skill.expert.name}</div>
                  <div className="text-sm text-gray-500">
                    {skill.expert.title} · {skill.expert.department}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                  🎯
                </div>
                <h3 className="font-semibold">{skill.name}</h3>
              </div>

              <Link
                href={`/elite/${skillId}/chat`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors mb-3"
              >
                <MessageCircle className="w-5 h-5" />
                咨询技能
              </Link>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">版本</span>
                  <span className="font-medium">v{skill.version || '1.0.0'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">分类</span>
                  <span className="font-medium">{skill.category}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">安装量</span>
                  <span className="font-medium">{skill.installCount} 人</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">更新时间</span>
                  <span className="font-medium">
                    {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/frontend/src/app/elite/[skillId]/page.tsx
git commit -m "feat(elite): add skill detail page"
```

---

## Task 8: 前端 - 咨询对话框页

**Files:**
- Create: `hq/frontend/src/app/elite/[skillId]/chat/page.tsx`

- [ ] **Step 1: 创建咨询对话框页**

```tsx
'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Sparkles, Lightbulb } from 'lucide-react';
import { useEliteSkill } from '../../../../hooks/useEliteSkills';
import { consultEliteSkill } from '../../../../lib/api-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const RECOMMENDED_QUESTIONS = [
  '这个技能适合在什么场景使用？',
  '如何使用这个技能提升工作效率？',
  '有哪些注意事项需要了解？',
];

export default function ChatPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const { skill, content, loading } = useEliteSkill(skillId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await consultEliteSkill(skillId, text.trim());
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，咨询服务暂时不可用，请稍后再试。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">技能不存在</p>
          <Link href="/elite" className="text-purple-500 hover:underline mt-4 inline-block">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link
            href={`/elite/${skillId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold">{skill.name}</h1>
              <p className="text-sm text-gray-500">AI 咨询助手 · 基于 {skill.expert.name} 经验</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">开始咨询</h2>
                <p className="text-gray-500 mb-6">
                  基于「{skill.name}」的内容，AI 将为你解答相关问题
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {RECOMMENDED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-purple-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gradient-to-br from-purple-500 to-violet-600 text-white'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white shadow-sm'
                }`}>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white">
                  🤖
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
                  placeholder="输入你的问题..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isLoading}
                  className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  发送
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                💡 基于「{skill.name} v{skill.version || '1.0.0'}」内容回答
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 bg-white p-6 overflow-y-auto hidden lg:block">
          {/* Skill Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              技能核心内容
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              <div className="font-medium mb-2">{skill.name}</div>
              <div className="text-gray-500 text-xs mb-3">
                {skill.expert.name} · {skill.expert.department}
              </div>
              <div className="prose prose-sm prose-gray">
                {skill.description}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-amber-800 text-sm">使用技巧</span>
            </div>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• 问题越具体，回答越精准</li>
              <li>• 可以追问，AI 会深入解答</li>
              <li>• 点击推荐问题快速开始</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/frontend/src/app/elite/[skillId]/chat/page.tsx
git commit -m "feat(elite): add skill chat page"
```

---

## Task 9: 前端 - 管理面板页

**Files:**
- Create: `hq/frontend/src/app/elite/admin/page.tsx`

- [ ] **Step 1: 创建管理面板页**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload, Webhook, Check, X, ArrowDown, ArrowUp } from 'lucide-react';
import { useEliteSkills } from '../../../hooks/useEliteSkills';
import type { EliteSkill } from '../../../lib/api-client';

type TabType = 'all' | 'pending' | 'published' | 'deprecated';

export default function AdminPage() {
  const { skills, loading, error, publishSkill, deprecateSkill, deleteSkill } = useEliteSkills();
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');

  const filteredSkills = skills.filter(skill => {
    const matchesTab = tab === 'all' || skill.status === tab;
    const matchesSearch = skill.name.toLowerCase().includes(search.toLowerCase()) ||
      skill.expert.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: EliteSkill['status']) => {
    switch (status) {
      case 'published':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">已发布</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">待审核</span>;
      case 'deprecated':
        return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">已下架</span>;
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishSkill(id);
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  };

  const handleDeprecate = async (id: string) => {
    try {
      await deprecateSkill(id);
    } catch (err) {
      console.error('Failed to deprecate:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个技能吗？')) return;
    try {
      await deleteSkill(id);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const counts = {
    all: skills.length,
    pending: skills.filter(s => s.status === 'pending').length,
    published: skills.filter(s => s.status === 'published').length,
    deprecated: skills.filter(s => s.status === 'deprecated').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                精英克隆 · 管理面板
              </h1>
              <p className="text-gray-500 mt-1">管理公司技能库</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/elite"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                返回技能广场
              </Link>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Webhook className="w-4 h-4" />
                联网搜索
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                <Plus className="w-4 h-4" />
                上传技能
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {([
              { key: 'all', label: '全部', count: counts.all },
              { key: 'pending', label: '待审核', count: counts.pending },
              { key: 'published', label: '已发布', count: counts.published },
              { key: 'deprecated', label: '已下架', count: counts.deprecated },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索技能或专家..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">加载中...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">技能</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">专家</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">分类</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">更新时间</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      暂无技能
                    </td>
                  </tr>
                ) : (
                  filteredSkills.map(skill => (
                    <tr key={skill.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{skill.name}</div>
                        <div className="text-sm text-gray-500">v{skill.version || '1.0.0'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">{skill.expert.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {skill.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(skill.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {skill.status === 'pending' && (
                            <button
                              onClick={() => handlePublish(skill.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="发布"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {skill.status === 'published' && (
                            <button
                              onClick={() => handleDeprecate(skill.id)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="下架"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          )}
                          {skill.status === 'deprecated' && (
                            <button
                              onClick={() => handlePublish(skill.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="重新发布"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(skill.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add hq/frontend/src/app/elite/admin/page.tsx
git commit -m "feat(elite): add admin panel page"
```

---

## Task 10: 测试验证

**Files:**
- Test: `hq/backend/src/__tests__/elite.test.ts` (create)

- [ ] **Step 1: 编写后端测试**

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as eliteRepo from '../persistence/elite-repositories';

describe('Elite Skill Repository', () => {
  // Tests would go here - omitted for brevity
});
```

- [ ] **Step 2: 测试 API**

```bash
# 启动后端
cd hq && npm run build && npm run start:web &

# 测试端点
curl http://localhost:3333/api/elite/skills
curl http://localhost:3333/api/elite/skills/all

# 测试创建技能
curl -X POST http://localhost:3333/api/elite/skills \
  -H "Content-Type: application/json" \
  -d '{"name":"测试技能","description":"测试描述","expert":{"name":"张三","department":"技术部","title":"高级工程师"},"category":"engineering","tags":["test"],"content":"# Test"}'
```

- [ ] **Step 3: 验证前端页面**

打开浏览器访问：
- http://localhost:3008/elite - 技能列表页
- http://localhost:3008/elite/[skillId] - 技能详情页
- http://localhost:3008/elite/[skillId]/chat - 咨询对话框
- http://localhost:3008/elite/admin - 管理面板

---

## 实现检查清单

- [ ] Task 1: EliteSkill 类型定义
- [ ] Task 2: 文件仓储层
- [ ] Task 3: API 路由
- [ ] Task 4: 前端 API Client
- [ ] Task 5: useEliteSkills Hook
- [ ] Task 6: 技能列表页
- [ ] Task 7: 技能详情页
- [ ] Task 8: 咨询对话框页
- [ ] Task 9: 管理面板页
- [ ] Task 10: 测试验证
