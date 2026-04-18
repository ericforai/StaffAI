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
import type { UserContext } from '../identity/user-types';
import * as eliteRepo from '../persistence/elite-repositories';
import { gitHubSearchService } from '../market/github-search';

const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_HOST = 'raw.githubusercontent.com';

async function consultWithAI(skillContent: string, skillName: string, expertName: string, question: string): Promise<string> {
  if (!ANTHROPIC_AUTH_TOKEN) {
    throw new Error('AI service not configured');
  }

  const systemPrompt = `你是一个专业的技能顾问，基于以下技能内容回答用户的问题。

## 技能信息
- 技能名称：${skillName}
- 专家：${expertName}

## 技能内容（SKILL.md）
${skillContent}

## 回答要求
1. 仔细阅读技能内容，从中提取相关信息
2. 用专业、友好的语气回答
3. 如果技能内容中没有相关信息，诚实地说明这一点
4. 回答要具体、实用，引用技能中的具体内容会更好
5. 保持回答简洁但有价值（通常 100-500 字）
`;

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANTHROPIC_AUTH_TOKEN}`,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const textContent = data.content?.find((item) => item.type === 'text')?.text;
    if (!textContent) {
      throw new Error('No text in AI response');
    }

    return textContent;
  } catch (error) {
    console.error('AI consultation error:', error);
    throw error;
  }
}

interface EliteRouteDependencies {}

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

function isAdminUser(userContext?: UserContext | null): userContext is UserContext {
  return userContext?.clearanceLevel === 'admin';
}

function ensureAdmin(
  req: { userContext?: UserContext | null },
  res: { status: (code: number) => { json: (payload: unknown) => unknown } },
): boolean {
  if (isAdminUser(req.userContext)) {
    return true;
  }

  res.status(403).json({ error: 'Forbidden' });
  return false;
}

function getGitHubHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'StaffAI-HQ',
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

function parseGitHubImportTarget(input: string):
  | { kind: 'repo'; owner: string; repo: string }
  | { kind: 'raw'; url: string } {
  const isSafeName = (value: string) => /^[a-zA-Z0-9._-]+$/.test(value);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input);
  } catch {
    throw new Error('Only GitHub repository, blob, or raw URLs are allowed');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only GitHub repository, blob, or raw URLs are allowed');
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean);

  if (parsedUrl.hostname === 'github.com') {
    if (segments.length === 2 || (segments.length === 3 && segments[2] === '')) {
      // Handle .git suffix by stripping it
      let repo = segments[1] || segments[2];
      if (repo.endsWith('.git')) {
        repo = repo.slice(0, -4);
      }
      if (!isSafeName(segments[0]) || !isSafeName(repo)) {
        throw new Error('Only GitHub repository, blob, or raw URLs are allowed');
      }
      return {
        kind: 'repo',
        owner: segments[0],
        repo: repo,
      };
    }

    if (segments.length >= 5 && segments[2] === 'blob') {
      if (!isSafeName(segments[0]) || !isSafeName(segments[1])) {
        throw new Error('Only GitHub repository, blob, or raw URLs are allowed');
      }
      return {
        kind: 'raw',
        url: `https://${GITHUB_RAW_HOST}/${segments[0]}/${segments[1]}/${segments[3]}/${segments.slice(4).map(encodeURIComponent).join('/')}`,
      };
    }
  }

  if (parsedUrl.hostname === GITHUB_RAW_HOST && segments.length >= 4) {
    return { kind: 'raw', url: parsedUrl.toString() };
  }

  throw new Error('Only GitHub repository, blob, or raw URLs are allowed');
}

export function registerEliteRoutes(app: Router, deps: EliteRouteDependencies) {
  void deps;

  app.get('/api/elite/skills', async (_req, res) => {
    try {
      const skills = await eliteRepo.listPublishedSkills();
      return res.json({ skills, total: skills.length });
    } catch (error) {
      console.error('List elite skills error:', error);
      return res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  app.get('/api/elite/skills/all', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

    try {
      const skills = await eliteRepo.listAllSkills();
      return res.json({ skills, total: skills.length });
    } catch (error) {
      console.error('List all elite skills error:', error);
      return res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  app.get('/api/elite/skills/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    try {
      // Search for repositories containing SKILL.md using topic search
      const searchQuery = `${query} in:readme SKILL.md`;
      const repos = await gitHubSearchService.searchRepositories(searchQuery, { perPage: 20 });

      const results = repos.map((repo) => ({
        name: repo.name,
        description: repo.description || `来自 ${repo.owner}/${repo.name}`,
        url: repo.url,
        stars: repo.stars,
        author: repo.owner,
        path: 'SKILL.md',
      }));

      return res.json({ results });
    } catch (error) {
      console.error('Search error:', error);

      if (error instanceof Error && error.name === 'GitHubSearchError') {
        const ghError = error as { code?: string; details?: { retryAfter?: number } };
        if (ghError.code === 'RATE_LIMIT_EXCEEDED') {
          return res.status(429).json({
            error: 'GitHub rate limit exceeded',
            retryAfter: ghError.details?.retryAfter,
          });
        }
      }

      return res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/elite/skills/import', async (req, res) => {
    const encodedUrl = req.query.url as string;
    if (!encodedUrl) {
      return res.status(400).json({ error: 'Missing URL' });
    }

    // Decode URL in case it's percent-encoded
    const url = decodeURIComponent(encodedUrl);

    try {
      const target = parseGitHubImportTarget(url);
      let content = '';

      if (target.kind === 'repo') {
        // Try common branch names for public repos (no auth needed for raw content)
        const branches = ['main', 'master'];
        let fetched = false;

        for (const branch of branches) {
          const rawUrl = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${branch}/SKILL.md`;
          const fileResponse = await fetch(rawUrl, {
            headers: { 'User-Agent': 'StaffAI-HQ' },
          });

          if (fileResponse.ok) {
            content = await fileResponse.text();
            fetched = true;
            break;
          }
        }

        if (!fetched) {
          // Fallback: try API to get default branch
          try {
            const repoResponse = await fetch(`${GITHUB_API_BASE}/repos/${target.owner}/${target.repo}`, {
              headers: getGitHubHeaders(),
            });

            if (repoResponse.ok) {
              const repoData = await repoResponse.json() as { default_branch?: string };
              const branch = repoData.default_branch || 'main';
              const rawUrl = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${branch}/SKILL.md`;
              const fileResponse = await fetch(rawUrl, {
                headers: { 'User-Agent': 'StaffAI-HQ' },
              });

              if (fileResponse.ok) {
                content = await fileResponse.text();
                fetched = true;
              }
            }
          } catch {
            // Ignore API errors
          }
        }

        if (!fetched) {
          throw new Error('仓库中未找到 SKILL.md 文件或无法访问');
        }
      } else {
        const fileResponse = await fetch(target.url, {
          headers: { 'User-Agent': 'StaffAI-HQ' },
        });
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.status}`);
        }
        content = await fileResponse.text();
      }

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let parsed = {
        content,
        name: '',
        description: '',
      };

      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const body = frontmatterMatch[2];

        const nameMatch = frontmatter.match(/name:\s*"?([^"\n]+)"?/);
        const descMatch = frontmatter.match(/description:\s*"?([^"\n]+)"?/);

        parsed = {
          content: body.trim(),
          name: nameMatch?.[1] || '',
          description: descMatch?.[1] || '',
        };
      }

      return res.json(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only GitHub')) {
        return res.status(400).json({ error: error.message });
      }

      console.error('Import error:', error);
      const message = error instanceof Error ? error.message : 'Failed to import skill';
      return res.status(500).json({ error: message });
    }
  });

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

  app.post('/api/elite/skills', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const adminUser = req.userContext!;

    const validation = createSkillSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid skill data', details: validation.error.issues });
    }

    try {
      const skill = await eliteRepo.createSkill({
        ...validation.data,
        createdBy: adminUser.id,
      });

      return res.status(201).json({ skill });
    } catch (error) {
      console.error('Create elite skill error:', error);
      return res.status(500).json({ error: 'Failed to create skill' });
    }
  });

  app.put('/api/elite/skills/:id', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

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

  app.delete('/api/elite/skills/:id', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

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

  app.post('/api/elite/skills/:id/publish', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

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

  app.post('/api/elite/skills/:id/deprecate', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

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

  app.post('/api/elite/skills/:id/clone', async (req, res) => {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const adminUser = req.userContext!;

    try {
      const cloned = await eliteRepo.cloneSkill(req.params.id, adminUser.id);
      if (!cloned) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.status(201).json({ skill: cloned });
    } catch (error) {
      console.error('Clone elite skill error:', error);
      return res.status(500).json({ error: 'Failed to clone skill' });
    }
  });

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

      const answer = await consultWithAI(
        skillFile.content,
        skillFile.skill.name,
        skillFile.skill.expert.name,
        validation.data.question,
      );

      return res.json({
        answer,
        skillId: req.params.id,
        skillName: skillFile.skill.name,
      });
    } catch (error) {
      console.error('Consult elite skill error:', error);
      const message = error instanceof Error ? error.message : 'Failed to consult skill';

      if (message.includes('529') || message.includes('overloaded')) {
        return res.status(503).json({
          error: 'AI 服务暂时繁忙，请稍后重试',
          retryable: true,
        });
      }
      if (message.includes('401') || message.includes('unauthorized')) {
        return res.status(503).json({
          error: 'AI 服务认证失败，请检查配置',
          retryable: false,
        });
      }

      return res.status(500).json({ error: message });
    }
  });
}
