/**
 * Market API Routes
 *
 * REST API for talent marketplace - discovering external agents via GitHub
 * and managing candidate pool with evaluation and import workflows.
 *
 * Endpoints:
 * - POST   /api/market/search          - Search GitHub for candidates
 * - GET    /api/market/candidates      - List candidate pool
 * - POST   /api/market/candidates/:id/import   - Import to organization
 * - POST   /api/market/candidates/:id/observe  - Set observing status
 * - DELETE /api/market/candidates/:id   - Remove candidate
 * - POST   /api/market/candidates/:id/refresh  - Re-evaluate candidate
 *
 * @module api/market
 */

import type { Router } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { GitHubRepo } from '../market/github-search';
import { gitHubSearchService } from '../market/github-search';
import type { CandidateEvaluation, EvaluationInput } from '../market/candidate-evaluator';
import { evaluateCandidate } from '../market/candidate-evaluator';
import type { CandidateRepository, Candidate, CandidateCapability } from '../market/candidate-repository';
import { createFileCandidateRepository } from '../market/candidate-repository';
import type { Store } from '../store';
import type { AgentProfile } from '../types';

// =============================================================================
// Types
// =============================================================================

interface MarketRouteDependencies {
  store: Store;
  getAgentProfiles?: () => AgentProfile[];
}

// =============================================================================
// Configuration
// =============================================================================

const CANDIDATES_FILE = `${process.env.AGENCY_HOME || process.cwd()}/candidates.json`;

// Preset search queries
const PRESET_SEARCHES = {
  'agent-framework': 'topic:agent-framework language:typescript',
  'mcp': 'topic:ai-agent topic:mcp',
  'llm': 'topic:llm-agent',
} as const;

type PresetSearchKey = keyof typeof PRESET_SEARCHES;

// =============================================================================
// Validation Schemas
// =============================================================================

const searchSchema = z.object({
  query: z.string().optional(),
  preset: z.enum(['agent-framework', 'mcp', 'llm']).optional(),
  url: z.string().url().optional(),
  perPage: z.number().min(1).max(100).optional(),
});

const importSchema = z.object({
  targetCategory: z.string().optional(),
});

const observeSchema = z.object({
  notes: z.string().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse GitHub owner/repo from URL
 */
function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  return { owner: match[1], name: match[2].replace('.git', '') };
}

/**
 * Convert GitHubRepo to Candidate format
 */
function gitHubRepoToCandidate(
  repo: GitHubRepo,
  evaluation: CandidateEvaluation,
  status: 'candidate' | 'observing' | 'imported' | 'removed' = 'candidate'
): Omit<Parameters<NonNullable<CandidateRepository['add']>>[0], 'id' | 'createdAt' | 'updatedAt'> {
  return {
    source: 'github',
    url: repo.url,
    owner: repo.owner,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    score: {
      stars: repo.stars,
      forks: repo.forks,
      lastUpdated: repo.updatedAt,
    },
    topics: repo.topics,
    evaluation: {
      score: evaluation.score,
      rating: evaluation.recommendation === 'not-recommended'
        ? 'not-recommended' as const
        : evaluation.recommendation === 'highly-recommended'
        ? 'recommended' as const
        : 'consider' as const,
      tier: evaluation.tier,
      strengths: evaluation.strengths,
      concerns: evaluation.concerns,
      evaluatedAt: new Date().toISOString(),
    },
    capability: inferCapability(repo, evaluation),
    status,
  };
}

/**
 * Infer candidate capability from repo and evaluation
 */
function inferCapability(
  repo: GitHubRepo,
  evaluation: CandidateEvaluation
): { category: string; specialties: string[]; description: string; skills: string[] } {
  // Infer category from language and topics
  const category = inferCategory(repo.language, repo.topics);

  // Extract specialties from topics
  const specialties = repo.topics
    .filter((t) => !['agent', 'ai', 'llm', 'automation', 'bot'].includes(t))
    .slice(0, 5);

  // Skills from topics and language
  const skills = [
    ...(repo.language ? [repo.language] : []),
    ...repo.topics.filter((t) =>
      ['typescript', 'python', 'javascript', 'rust', 'go', 'java', 'mcp', 'api', 'rest', 'graphql'].includes(
        t.toLowerCase()
      )
    ),
  ];

  return {
    category,
    specialties,
    description: repo.description || `${repo.owner}/${repo.name}`,
    skills,
  };
}

/**
 * Infer agent category from language and topics
 */
function inferCategory(language: string | undefined, topics: string[]): string {
  const lang = language?.toLowerCase() || '';
  const topicsLower = topics.map((t) => t.toLowerCase());

  if (topicsLower.some((t) => t.includes('frontend') || t.includes('ui') || t.includes('react') || t.includes('vue'))) {
    return 'engineering';
  }
  if (topicsLower.some((t) => t.includes('backend') || t.includes('api') || t.includes('server'))) {
    return 'engineering';
  }
  if (topicsLower.some((t) => t.includes('design') || t.includes('ux'))) {
    return 'design';
  }
  if (topicsLower.some((t) => t.includes('test') || t.includes('qa'))) {
    return 'testing';
  }
  if (topicsLower.some((t) => t.includes('doc'))) {
    return 'project-management';
  }

  // Default to engineering for technical repos
  return ['typescript', 'javascript', 'python', 'rust', 'go', 'java'].includes(lang)
    ? 'engineering'
    : 'specialized';
}

// =============================================================================
// Route Registration
// =============================================================================

export function registerMarketRoutes(
  app: Router,
  dependencies: MarketRouteDependencies
) {
  const candidateRepo = createFileCandidateRepository(CANDIDATES_FILE);

  /**
   * POST /api/market/search
   * Search GitHub for candidates and evaluate them
   */
  app.post('/api/market/search', async (req, res) => {
    const validation = searchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid search parameters', details: validation.error.issues });
    }

    const { query, preset, url, perPage } = validation.data;

    try {
      let repos: GitHubRepo[] = [];

      // Handle custom URL
      if (url) {
        const parsed = parseGitHubUrl(url);
        if (!parsed) {
          return res.status(400).json({ error: 'Invalid GitHub URL format' });
        }

        const repo = await gitHubSearchService.getRepository(parsed.owner, parsed.name);
        if (!repo) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        repos = [repo];
      }
      // Handle preset search
      else if (preset) {
        const searchQuery = PRESET_SEARCHES[preset];
        repos = await gitHubSearchService.searchRepositories(searchQuery, { perPage });
      }
      // Handle custom query
      else if (query) {
        repos = await gitHubSearchService.searchRepositories(query, { perPage });
      } else {
        return res.status(400).json({ error: 'Must provide query, preset, or url' });
      }

      // Evaluate each repository
      const evaluations: Array<{
        evaluation: CandidateEvaluation;
        repo: GitHubRepo;
      }> = [];

      for (const repo of repos) {
        const input: EvaluationInput = { repo };
        const evaluation = evaluateCandidate(input);
        evaluations.push({ evaluation, repo });
      }

      // Store candidates in pool
      const candidates = await Promise.all(
        evaluations.map(async ({ evaluation, repo }) => {
          const candidateData = gitHubRepoToCandidate(repo, evaluation);

          // Check if already exists
          const existing = await candidateRepo.getByUrl(repo.url);
          if (existing) {
            // Update evaluation
            return await candidateRepo.update(existing.id, (c) => ({
              ...c,
              evaluation: candidateData.evaluation,
              capability: candidateData.capability,
            }));
          }

          return await candidateRepo.add(candidateData);
        })
      );

      return res.json({
        candidates,
        total: candidates.length,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'GitHubSearchError') {
        const ghError = error as { code?: string; details?: { retryAfter?: number } };
        if (ghError.code === 'RATE_LIMIT_EXCEEDED') {
          return res.status(429).json({
            error: 'GitHub rate limit exceeded',
            retryAfter: ghError.details?.retryAfter,
          });
        }
      }

      console.error('Market search error:', error);
      return res.status(500).json({ error: 'Failed to search candidates' });
    }
  });

  /**
   * GET /api/market/candidates
   * List all candidates in the pool
   */
  app.get('/api/market/candidates', async (req, res) => {
    try {
      const { status, source, minScore } = req.query;

      let candidates = await candidateRepo.list({
        source: source as 'github' | 'npm' | 'pypi' | 'custom' | undefined,
      });

      // Filter by status
      if (status && typeof status === 'string') {
        candidates = candidates.filter((c) => c.status === status);
      }

      // Filter by evaluation score
      if (minScore && typeof minScore === 'string') {
        const score = parseInt(minScore, 10);
        candidates = candidates.filter((c) => c.evaluation?.score !== undefined && c.evaluation.score >= score);
      }

      return res.json({ candidates, total: candidates.length });
    } catch (error) {
      console.error('List candidates error:', error);
      return res.status(500).json({ error: 'Failed to list candidates' });
    }
  });

  /**
   * GET /api/market/candidates/:id
   * Get a single candidate by ID
   */
  app.get('/api/market/candidates/:id', async (req, res) => {
    try {
      const candidate = await candidateRepo.getById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      return res.json({ candidate });
    } catch (error) {
      console.error('Get candidate error:', error);
      return res.status(500).json({ error: 'Failed to get candidate' });
    }
  });

  /**
   * POST /api/market/candidates/:id/import
   * Import a candidate to the organization as an employee
   */
  app.post('/api/market/candidates/:id/import', async (req, res) => {
    const validation = importSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid import parameters' });
    }

    try {
      const candidate = await candidateRepo.getById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      // Check if already imported
      if (candidate.status === 'imported') {
        return res.status(409).json({ error: 'Candidate already imported' });
      }

      // Generate employee agent file
      const employeeId = `emp_${candidate.owner}_${candidate.name}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
      // Resolve from project root so Scanner can discover the file
      // Note: __dirname = hq/backend/dist/api/, need 4 levels to reach project root
      const projectRoot = path.resolve(__dirname, '../../../../');
      const employeesDir = path.join(projectRoot, 'hq', 'generated', 'employees');
      const targetPath = path.join(employeesDir, `${employeeId}.md`);
      const relativePath = `hq/generated/employees/${employeeId}.md`;

      // Create agent markdown content
      const agentContent = generateAgentMarkdown(candidate, employeeId);

      // Write agent file
      await fs.mkdir(employeesDir, { recursive: true });
      await fs.writeFile(targetPath, agentContent, 'utf-8');

      // Update candidate status
      const updated = await candidateRepo.update(req.params.id, (c) => ({
        ...c,
        status: 'imported',
        importedAs: {
          employeeId,
          importedAt: new Date().toISOString(),
        },
      }));

      // Trigger scanner to pick up new employee
      // (scanner will auto-detect new files in hq/generated/)

      return res.json({
        success: true,
        employeeId,
        employeePath: relativePath,
        candidate: updated,
      });
    } catch (error) {
      console.error('Import candidate error:', error);
      return res.status(500).json({ error: 'Failed to import candidate' });
    }
  });

  /**
   * POST /api/market/candidates/:id/observe
   * Set candidate to observing status
   */
  app.post('/api/market/candidates/:id/observe', async (req, res) => {
    const validation = observeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid observe parameters' });
    }

    try {
      const candidate = await candidateRepo.getById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      const updated = await candidateRepo.update(req.params.id, (c) => ({
        ...c,
        status: 'observing',
        observeNotes: validation.data.notes,
        observedAt: new Date().toISOString(),
      }));

      return res.json({ candidate: updated });
    } catch (error) {
      console.error('Observe candidate error:', error);
      return res.status(500).json({ error: 'Failed to set observing status' });
    }
  });

  /**
   * DELETE /api/market/candidates/:id
   * Remove a candidate from the pool
   */
  app.delete('/api/market/candidates/:id', async (req, res) => {
    try {
      const deleted = await candidateRepo.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Delete candidate error:', error);
      return res.status(500).json({ error: 'Failed to delete candidate' });
    }
  });

  /**
   * POST /api/market/candidates/:id/refresh
   * Re-evaluate a candidate
   */
  app.post('/api/market/candidates/:id/refresh', async (req, res) => {
    try {
      const candidate = await candidateRepo.getById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      // Fetch updated repo data
      const parsed = parseGitHubUrl(candidate.url);
      if (!parsed) {
        return res.status(400).json({ error: 'Invalid candidate URL' });
      }

      const repo = await gitHubSearchService.getRepository(parsed.owner, parsed.name);
      if (!repo) {
        return res.status(404).json({ error: 'Repository not found on GitHub' });
      }

      // Re-evaluate
      const input: EvaluationInput = { repo };
      const evaluation = evaluateCandidate(input);

      // Update candidate with new evaluation
      const updated = await candidateRepo.update(req.params.id, (c) => ({
        ...c,
        score: {
          stars: repo.stars,
          forks: repo.forks,
          lastUpdated: repo.updatedAt,
        },
        topics: repo.topics,
        evaluation: {
          score: evaluation.score,
          rating: evaluation.recommendation === 'not-recommended'
            ? 'not-recommended' as const
            : evaluation.recommendation === 'highly-recommended'
            ? 'recommended' as const
            : 'consider' as const,
          tier: evaluation.tier,
          strengths: evaluation.strengths,
          concerns: evaluation.concerns,
          evaluatedAt: new Date().toISOString(),
        },
        capability: inferCapability(repo, evaluation),
      }));

      return res.json({ candidate: updated });
    } catch (error) {
      console.error('Refresh candidate error:', error);
      return res.status(500).json({ error: 'Failed to refresh candidate' });
    }
  });

  /**
   * GET /api/market/stats
   * Get candidate pool statistics
   */
  app.get('/api/market/stats', async (_req, res) => {
    try {
      const candidates = await candidateRepo.list();

      const stats = {
        total: candidates.length,
        byStatus: {
          candidate: candidates.filter((c) => c.status === 'candidate').length,
          observing: candidates.filter((c) => c.status === 'observing').length,
          imported: candidates.filter((c) => c.status === 'imported').length,
          removed: candidates.filter((c) => c.status === 'removed').length,
        },
        byRating: {
          recommended: candidates.filter((c) => c.evaluation?.rating === 'recommended').length,
          consider: candidates.filter((c) => c.evaluation?.rating === 'consider').length,
          'not-recommended': candidates.filter((c) => c.evaluation?.rating === 'not-recommended').length,
        },
        avgScore: candidates.length > 0
          ? candidates.reduce((sum, c) => sum + (c.evaluation?.score || 0), 0) / candidates.length
          : 0,
      };

      return res.json(stats);
    } catch (error) {
      console.error('Stats error:', error);
      return res.status(500).json({ error: 'Failed to get statistics' });
    }
  });
}

// =============================================================================
// Agent Markdown Generator
// =============================================================================

/**
 * Generate agent markdown file from candidate data
 */
function generateAgentMarkdown(
  candidate: Candidate,
  employeeId: string
): string {
  const eval_ = candidate.evaluation;
  const capability: CandidateCapability = candidate.capability || {
    category: 'specialized',
    specialties: [],
    description: candidate.description || `${candidate.owner}/${candidate.name}`,
    skills: [],
  };
  const score = candidate.score || {};

  const ratingEmoji = eval_?.rating === 'recommended' ? '🟢' :
                      eval_?.rating === 'consider' ? '🟡' : '🔴';

  return `---
name: ${candidate.name}
description: ${candidate.description || candidate.owner + '/' + candidate.name}
category: ${capability.category || 'specialized'}
emoji: 🤖
color: blue
source: github
url: ${candidate.url}
importedAt: ${new Date().toISOString()}
evaluationScore: ${eval_?.score || 'N/A'}
evaluationRating: ${eval_?.rating || 'N/A'}
---

## Your Identity & Memory

You are an AI agent specialist imported from the GitHub repository **${candidate.owner}/${candidate.name}**.

${candidate.description ? `**Specialty**: ${candidate.description}` : ''}

${capability.skills?.length ? `**Technical Skills**: ${capability.skills.join(', ')}` : ''}

**Repository Stats**:
- ⭐ Stars: ${score.stars || 0}
- 🍴 Forks: ${score.forks || 0}
- ${score.lastUpdated ? `📅 Last Updated: ${new Date(score.lastUpdated).toLocaleDateString()}` : ''}

**Evaluation**: ${ratingEmoji} ${eval_?.rating || 'pending'} (${eval_?.score || 'N/A'}/100)

${eval_?.strengths?.length ? `**Strengths**:\n${eval_.strengths.map((s: string) => `- ${s}`).join('\n')}` : ''}

${eval_?.concerns?.length ? `**Considerations**:\n${eval_.concerns.map((c: string) => `- ${c}`).join('\n')}` : ''}

## Your Core Mission

You bring expertise from the ${candidate.name} project to assist with tasks in the ${capability.category || 'specialized'} domain.

Your capabilities include:
${capability.specialties?.length ? capability.specialties.map((s: string) => `- ${s}`).join('\n') : '- General assistance based on your repository focus'}

## Critical Rules You Must Follow

1. **Stay in Domain**: Focus on tasks related to your expertise in ${capability.category || 'your specialized area'}
2. **Quality First**: Your repository has ${score.stars || 0} stars - maintain that quality standard
3. **Collaborate**: Work effectively with other agents in the organization
4. **Learn**: Adapt to the specific needs of each task

## Your Technical Deliverables

Based on your repository background, you can help with:

- **Code**: ${candidate.language || 'Various languages'} development
- **Documentation**: Technical writing and examples
${capability.skills?.length ? `- **Tools**: ${capability.skills.join(', ')}` : ''}

## Your Workflow Process

1. **Understand**: Analyze the task requirements clearly
2. **Plan**: Break down complex tasks into steps
3. **Execute**: Deliver high-quality work
4. **Verify**: Ensure outcomes meet standards

---

*This agent was imported from GitHub on ${new Date().toLocaleDateString()}.*
`;
}
