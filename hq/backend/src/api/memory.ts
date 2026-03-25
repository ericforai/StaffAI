/**
 * Memory API Routes
 *
 * Provides HTTP endpoints for memory retrieval operations.
 * All routes follow the pattern /api/memory/*
 */

import type express from 'express';
import {
  createMemoryRetriever,
  type FileMemoryRetriever,
} from '../memory/file-memory-retriever';
import type { RetrieveOptions } from '../memory/memory-retriever-types';

/**
 * Memory route dependencies
 */
export interface MemoryRouteDependencies {
  /** Root directory containing .ai/ folder */
  memoryRootDir: string;
}

/**
 * Parse and validate positive integer from query parameter
 */
function readPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (Number.isFinite(num) && num > 0) {
    return Math.floor(num);
  }

  return undefined;
}

/**
 * Parse boolean from query parameter
 */
function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }

  return false;
}

/**
 * Parse memory document types from query parameter
 */
function readDocumentTypes(value: unknown): RetrieveOptions['documentTypes'] {
  if (typeof value !== 'string') {
    return undefined;
  }

  const validTypes = new Set<string>(['project', 'task', 'decision', 'knowledge', 'agent']);
  const types = value.split(',').map((t) => t.trim().toLowerCase());

  const filtered = types.filter((t): t is 'project' | 'task' | 'decision' | 'knowledge' | 'agent' => validTypes.has(t));

  return filtered.length > 0 ? filtered : undefined;
}

/**
 * Parse time range from query parameters
 */
function readTimeRange(startStr: unknown, endStr: unknown): RetrieveOptions['timeRange'] {
  const start = startStr ? new Date(startStr as string) : undefined;
  const end = endStr ? new Date(endStr as string) : undefined;

  if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
    return undefined;
  }

  if (start || end) {
    return { start: start ?? new Date(0), end: end ?? new Date() };
  }

  return undefined;
}

/**
 * Build retrieve options from express request query
 */
function buildRetrieveOptions(query: express.Request['query']): Partial<RetrieveOptions> {
  const options: Partial<RetrieveOptions> = {};

  const limit = readPositiveInt(query.limit);
  if (limit !== undefined) {
    options.limit = limit;
  }

  const threshold = readPositiveInt(query.threshold);
  if (threshold !== undefined) {
    options.threshold = threshold;
  }

  if (query.includeFullContent !== undefined) {
    options.includeFullContent = readBoolean(query.includeFullContent);
  }

  const documentTypes = readDocumentTypes(query.documentTypes);
  if (documentTypes !== undefined) {
    options.documentTypes = documentTypes;
  }

  const timeRange = readTimeRange(query.timeRangeStart, query.timeRangeEnd);
  if (timeRange !== undefined) {
    options.timeRange = timeRange;
  }

  const excerptMaxChars = readPositiveInt(query.excerptMaxChars);
  if (excerptMaxChars !== undefined) {
    options.excerptMaxChars = excerptMaxChars;
  }

  const contextMaxChars = readPositiveInt(query.contextMaxChars);
  if (contextMaxChars !== undefined) {
    options.contextMaxChars = contextMaxChars;
  }

  if (query.fallbackMode === 'none' || query.fallbackMode === 'recent') {
    options.fallbackMode = query.fallbackMode;
  }

  return options;
}

/**
 * Register memory retrieval routes
 */
export function registerMemoryRoutes(
  app: express.Application,
  dependencies: MemoryRouteDependencies
) {
  const { memoryRootDir } = dependencies;

  // Create retriever instance
  const createRetriever = (): FileMemoryRetriever =>
    createMemoryRetriever({
      memoryRootDir,
      cacheTtlMs: 300000, // 5 minutes
      enableCache: true,
    });

  /**
   * GET /api/memory/retrieve
   *
   * General memory retrieval across all document types.
   *
   * Query params:
   * - query: string (required) - Search query
   * - limit: number - Max results (default: 3)
   * - threshold: number - Minimum score (default: 0)
   * - includeFullContent: boolean - Include full content
   * - documentTypes: string - Comma-separated types (project,task,decision,knowledge,agent)
   * - timeRangeStart: string - ISO date string
   * - timeRangeEnd: string - ISO date string
   * - excerptMaxChars: number - Max chars per excerpt (default: 300)
   * - contextMaxChars: number - Max total chars in context (default: 1600)
   * - fallbackMode: 'none' | 'recent' - Fallback behavior (default: recent)
   */
  app.get('/api/memory/retrieve', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';

    if (!query.trim()) {
      return res.status(400).json({
        error: 'query parameter "q" is required',
      });
    }

    const options = buildRetrieveOptions(req.query);
    const retriever = createRetriever();

    try {
      const result = await retriever.retrieve(query, options);
      return res.json(result);
    } catch (error) {
      // Log detailed error server-side for debugging
      console.error('[Memory API] Retrieval failed:', error);
      // Return generic error to client to avoid information leakage
      return res.status(500).json({
        error: 'Memory retrieval failed',
      });
    }
  });

  /**
   * GET /api/memory/tasks/:taskId
   *
   * Retrieve memory context for a specific task.
   *
   * Path params:
   * - taskId: string - Task identifier
   *
   * Query params: same as /api/memory/retrieve
   */
  app.get('/api/memory/tasks/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const options = buildRetrieveOptions(req.query);
    const retriever = createRetriever();

    try {
      const result = await retriever.retrieveForTask(query, taskId, options);
      return res.json(result);
    } catch (error) {
      // Log detailed error server-side for debugging
      console.error('[Memory API] Task retrieval failed:', error);
      // Return generic error to client to avoid information leakage
      return res.status(500).json({
        error: 'Task memory retrieval failed',
      });
    }
  });

  /**
   * GET /api/memory/decisions
   *
   * Retrieve decision records matching a query.
   *
   * Query params:
   * - q: string (required) - Search query
   * - Other params same as /api/memory/retrieve
   */
  app.get('/api/memory/decisions', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';

    if (!query.trim()) {
      return res.status(400).json({
        error: 'query parameter "q" is required',
      });
    }

    const options = buildRetrieveOptions(req.query);
    const retriever = createRetriever();

    try {
      const result = await retriever.retrieveDecisions(query, options);
      return res.json(result);
    } catch (error) {
      // Log detailed error server-side for debugging
      console.error('[Memory API] Decision retrieval failed:', error);
      // Return generic error to client to avoid information leakage
      return res.status(500).json({
        error: 'Decision retrieval failed',
      });
    }
  });

  /**
   * GET /api/memory/agents/:agentId
   *
   * Retrieve agent-specific memory context.
   *
   * Path params:
   * - agentId: string - Agent identifier
   *
   * Query params:
   * - q: string (optional) - Search query
   * - Other params same as /api/memory/retrieve
   */
  app.get('/api/memory/agents/:agentId', async (req, res) => {
    const agentId = req.params.agentId;
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const options = buildRetrieveOptions(req.query);
    const retriever = createRetriever();

    try {
      const result = await retriever.retrieveAgentContext(agentId, query, options);
      return res.json(result);
    } catch (error) {
      // Log detailed error server-side for debugging
      console.error('[Memory API] Agent context retrieval failed:', error);
      // Return generic error to client to avoid information leakage
      return res.status(500).json({
        error: 'Agent memory retrieval failed',
      });
    }
  });

  /**
   * GET /api/memory/project
   *
   * Retrieve general project context.
   *
   * Query params:
   * - q: string (optional) - Search query for filtering
   * - Other params same as /api/memory/retrieve
   */
  app.get('/api/memory/project', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const options = buildRetrieveOptions(req.query);
    const retriever = createRetriever();

    try {
      const result = await retriever.retrieveProjectContext(query, options);
      return res.json(result);
    } catch (error) {
      // Log detailed error server-side for debugging
      console.error('[Memory API] Project context retrieval failed:', error);
      // Return generic error to client to avoid information leakage
      return res.status(500).json({
        error: 'Project context retrieval failed',
      });
    }
  });

  /**
   * GET /api/memory/knowledge
   *
   * Retrieve knowledge base entries.
   *
   * Query params:
   * - q: string (required) - Search query
   * - domain: string (optional) - Domain filter (e.g., "engineering", "design")
   * - Other params same as /api/memory/retrieve
   */
  app.get('/api/memory/knowledge', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;

    if (!query.trim()) {
      return res.status(400).json({
        error: 'query parameter "q" is required',
      });
    }

    const options = buildRetrieveOptions(req.query);
    const retriever = createRetriever();

    try {
      const result = await retriever.retrieveKnowledge(query, domain, options);
      return res.json(result);
    } catch (error) {
      // Log detailed error server-side for debugging
      console.error('[Memory API] Knowledge retrieval failed:', error);
      // Return generic error to client to avoid information leakage
      return res.status(500).json({
        error: 'Knowledge retrieval failed',
      });
    }
  });
}
