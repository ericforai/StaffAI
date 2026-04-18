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

const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

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
        'Authorization': `Bearer ${ANTHROPIC_AUTH_TOKEN}`,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: question }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };

    // Extract text from response
    const textContent = data.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      throw new Error('No text in AI response');
    }

    return textContent;
  } catch (error) {
    console.error('AI consultation error:', error);
    throw error;
  }
}

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
   * GET /api/elite/skills/search
   * Search public skills via GitHub API (proxy to avoid CORS)
   * NOTE: This route MUST be before /:id to avoid being matched as a skill ID
   */
  app.get('/api/elite/skills/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'StaffAI-HQ',
      };
      if (GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
      }

      const response = await fetch(
        `https://api.github.com/search/code?q=SKILL.md+${encodeURIComponent(query)}&per_page=20`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ error: 'GitHub API 需要认证，请在环境变量中设置 GITHUB_TOKEN' });
        }
        if (response.status === 403) {
          return res.status(403).json({ error: 'GitHub API 访问受限，请稍后重试或设置 GITHUB_TOKEN' });
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json() as {
        items: Array<{
          name: string;
          html_url: string;
          repository: {
            full_name: string;
            stargazers_count: number;
            description: string;
          };
          path: string;
        }>;
      };

      const results = data.items.map(item => ({
        name: item.repository.full_name.split('/')[1] || item.name,
        description: item.repository.description || `来自 ${item.repository.full_name}`,
        url: item.html_url,
        stars: item.repository.stargazers_count,
        author: item.repository.full_name.split('/')[0],
        path: item.path,
      }));

      return res.json({ results });
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * GET /api/elite/skills/import
   * Import skill content from a GitHub URL (supports SKILL.md files and repo URLs)
   * NOTE: This route MUST be before /:id to avoid being matched as a skill ID
   */
  app.get('/api/elite/skills/import', async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL' });
    }

    try {
      let rawUrl = '';
      let content = '';

      // 判断是仓库 URL 还是文件 URL
      const isRepoUrl = url.match(/github\.com\/[\w-]+\/[\w.-]+$/);
      const isBlobUrl = url.includes('/blob/');

      if (isRepoUrl || isBlobUrl) {
        // 如果是仓库根 URL，先获取仓库内容查找 SKILL.md
        if (isRepoUrl && !url.includes('/blob/')) {
          // 仓库 URL - 查找 SKILL.md
          const repoApiUrl = url
            .replace('github.com', 'api.github.com/repos')
            .replace(/\/$/, '');

          const repoResponse = await fetch(repoApiUrl, {
            headers: {
              'User-Agent': 'StaffAI-HQ',
              Accept: 'application/vnd.github.v3+json',
            },
          });

          if (!repoResponse.ok) {
            throw new Error(`Failed to fetch repo: ${repoResponse.status}`);
          }

          const repoData = await repoResponse.json() as { full_name: string; default_branch: string };
          const defaultBranch = repoData.default_branch || 'main';

          // 获取仓库根目录内容
          const contentsUrl = `https://api.github.com/repos/${repoData.full_name}/contents`;
          const contentsResponse = await fetch(contentsUrl, {
            headers: {
              'User-Agent': 'StaffAI-HQ',
              Accept: 'application/vnd.github.v3+json',
            },
          });

          if (!contentsResponse.ok) {
            throw new Error(`Failed to fetch repo contents: ${contentsResponse.status}`);
          }

          const contents = await contentsResponse.json() as Array<{ name: string; download_url: string | null }>;

          // 查找 SKILL.md
          const skillFile = contents.find((f: { name: string }) => f.name === 'SKILL.md');
          if (!skillFile || !skillFile.download_url) {
            throw new Error('仓库中未找到 SKILL.md 文件');
          }

          rawUrl = skillFile.download_url;
        } else {
          // 文件 URL - 直接转换为 raw URL
          rawUrl = url
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
        }

        const fileResponse = await fetch(rawUrl, {
          headers: {
            'User-Agent': 'StaffAI-HQ',
          },
        });

        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.status}`);
        }

        content = await fileResponse.text();
      } else {
        // 其他 URL 直接尝试获取
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'StaffAI-HQ',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        content = await response.text();
      }

      // Parse frontmatter if present
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
      console.error('Import error:', error);
      const message = error instanceof Error ? error.message : 'Failed to import skill';
      return res.status(500).json({ error: message });
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

      // Call AI to get the answer
      const answer = await consultWithAI(
        skillFile.content,
        skillFile.skill.name,
        skillFile.skill.expert.name,
        validation.data.question
      );

      return res.json({
        answer,
        skillId: req.params.id,
        skillName: skillFile.skill.name,
      });
    } catch (error) {
      console.error('Consult elite skill error:', error);
      const message = error instanceof Error ? error.message : 'Failed to consult skill';

      // Provide more specific error messages
      if (message.includes('529') || message.includes('overloaded')) {
        return res.status(503).json({
          error: 'AI 服务暂时繁忙，请稍后重试',
          retryable: true
        });
      }
      if (message.includes('401') || message.includes('unauthorized')) {
        return res.status(503).json({
          error: 'AI 服务认证失败，请检查配置',
          retryable: false
        });
      }

      return res.status(500).json({ error: message });
    }
  });
}
