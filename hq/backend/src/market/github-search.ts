/**
 * GitHub Search Service
 *
 * Provides a thin client wrapper around GitHub's REST API for searching repositories
 * and fetching repository metadata. Handles rate limiting, authentication, and error
 * recovery at the data layer without business logic.
 *
 * Environment Variables:
 * - GITHUB_TOKEN: Optional GitHub personal access token for higher rate limits
 *
 * @module market/github-search
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Repository metadata returned by GitHub search
 */
export interface GitHubRepo {
  /** Full repository URL (https://github.com/owner/name) */
  url: string;
  /** Repository owner login */
  owner: string;
  /** Repository name */
  name: string;
  /** Repository description */
  description?: string;
  /** Homepage URL if set */
  homepage?: string;
  /** Primary programming language */
  language?: string;
  /** Star count */
  stars: number;
  /** Fork count */
  forks: number;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** Repository topics/tags */
  topics: string[];
  /** Whether a README exists */
  hasReadme: boolean;
  /** Whether a CONTRIBUTING file exists */
  hasContributing: boolean;
}

/**
 * Options for repository search
 */
export interface SearchOptions {
  /** Number of results per page (default: 30, max: 100) */
  perPage?: number;
}

/**
 * GitHub API rate limit info from response headers
 */
interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;
  /** Unix timestamp when limit resets */
  resetAt?: number;
  /** Seconds to wait before retry */
  retryAfter?: number;
}

/**
 * Raw GitHub API response for repository search
 */
interface GitHubSearchResponse {
  items: GitHubRepoItem[];
  total_count: number;
}

/**
 * Raw repository item from search results
 */
interface GitHubRepoItem {
  html_url: string;
  owner: { login: string };
  name: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics: string[];
}

/**
 * Raw repository detail response
 */
interface GitHubRepoDetail extends GitHubRepoItem {
  has_readme: boolean;
  has_contributing: boolean;
  default_branch: string;
}

// =============================================================================
// Configuration
// =============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_SEARCH_PER_PAGE = 30;
const MAX_SEARCH_PER_PAGE = 100;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 2;

// =============================================================================
// Implementation
// =============================================================================

/**
 * Extract rate limit information from fetch response headers
 */
function parseRateLimit(headers: Headers): RateLimitInfo {
  const remaining = parseInt(headers.get('x-ratelimit-remaining') ?? '0', 10);
  const resetAt = parseInt(headers.get('x-ratelimit-reset') ?? '0', 10) || undefined;
  const retryAfter = parseInt(headers.get('retry-after') ?? '0', 10) || undefined;

  return { remaining, resetAt, retryAfter };
}

/**
 * Build common headers for GitHub API requests
 * Reads GITHUB_TOKEN at call time (not import time) so .env loading works correctly
 */
function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Agency-HQ-GitHub-Search',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  return headers;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handle rate limit errors with retry information
 */
function handleRateLimit(response: Response, rateLimit: RateLimitInfo): never {
  const retryAfter = rateLimit.retryAfter ?? Math.ceil((rateLimit.resetAt ?? 0) - Date.now() / 1000);

  throw new GitHubSearchError(
    `GitHub rate limit exceeded. Retry after ${retryAfter}s.`,
    'RATE_LIMIT_EXCEEDED',
    { retryAfter: Math.max(0, retryAfter) }
  );
}

/**
 * Map raw GitHub API response to internal GitHubRepo format
 */
function mapToGitHubRepo(item: GitHubRepoDetail): GitHubRepo {
  return {
    url: item.html_url,
    owner: item.owner.login,
    name: item.name,
    description: item.description ?? undefined,
    homepage: item.homepage ?? undefined,
    language: item.language ?? undefined,
    stars: item.stargazers_count,
    forks: item.forks_count,
    updatedAt: item.updated_at,
    topics: item.topics ?? [],
    hasReadme: item.has_readme ?? false,
    hasContributing: item.has_contributing ?? false,
  };
}

/**
 * Custom error class for GitHub search failures
 */
export class GitHubSearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GitHubSearchError';
  }
}

/**
 * GitHub Search Service Implementation
 */
export const gitHubSearchService: GitHubSearchService = {
  /**
   * Search GitHub repositories by query
   *
   * @param query - Search query (GitHub search syntax)
   * @param options - Search options
   * @returns Array of matching repositories
   * @throws {GitHubSearchError} On network or API errors
   */
  async searchRepositories(query: string, options: SearchOptions = {}): Promise<GitHubRepo[]> {
    const perPage = Math.min(options.perPage ?? DEFAULT_SEARCH_PER_PAGE, MAX_SEARCH_PER_PAGE);
    const searchParams = new URLSearchParams({
      q: query,
      per_page: perPage.toString(),
      sort: 'stars',
      order: 'desc',
    });

    const url = `${GITHUB_API_BASE}/search/repositories?${searchParams}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(url, {
          headers: buildHeaders(),
        }, REQUEST_TIMEOUT);

        const rateLimit = parseRateLimit(response.headers);

        // Handle rate limiting
        if (response.status === 403 && rateLimit.remaining === 0) {
          handleRateLimit(response, rateLimit);
        }

        if (!response.ok) {
          throw new GitHubSearchError(
            `GitHub API error: ${response.status} ${response.statusText}`,
            'API_ERROR',
            { status: response.status }
          );
        }

        const data = (await response.json()) as GitHubSearchResponse;

        // Optimize: Only fetch details for top 3 results, use basic data for rest
        const topItems = data.items.slice(0, 3);
        const restItems = data.items.slice(3, 10);

        // Fetch detailed info for top results
        const detailedRepos = await Promise.all(
          topItems.map(async (item) => {
            const detail = await this.getRepository(item.owner.login, item.name);
            return detail;
          })
        );

        // Use basic data for remaining results
        const basicRepos: GitHubRepo[] = restItems.map((item) => ({
          url: item.html_url,
          owner: item.owner.login,
          name: item.name,
          description: item.description ?? undefined,
          homepage: item.homepage ?? undefined,
          language: item.language ?? undefined,
          stars: item.stargazers_count,
          forks: item.forks_count,
          updatedAt: item.updated_at,
          topics: item.topics ?? [],
          hasReadme: false,
          hasContributing: false,
        }));

        // Combine and filter nulls
        const repos = [...detailedRepos, ...basicRepos].filter((r): r is GitHubRepo => r !== null);

        return repos;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on rate limit or client errors (4xx)
        if (error instanceof GitHubSearchError) {
          if (error.code === 'RATE_LIMIT_EXCEEDED') throw error;
          if (error.details?.status && typeof error.details.status === 'number') {
            const status = error.details.status as number;
            if (status >= 400 && status < 500 && status !== 429) throw error;
          }
        }

        // Retry on network errors or timeout
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new GitHubSearchError(
      `Failed to search repositories after ${MAX_RETRIES + 1} attempts`,
      'NETWORK_ERROR',
      { cause: lastError?.message }
    );
  },

  /**
   * Get detailed repository information
   *
   * @param owner - Repository owner login
   * @param name - Repository name
   * @returns Repository details or null if not found
   */
  async getRepository(owner: string, name: string): Promise<GitHubRepo | null> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${name}`;

    try {
      const response = await fetchWithTimeout(url, {
        headers: buildHeaders(),
      }, REQUEST_TIMEOUT);

      const rateLimit = parseRateLimit(response.headers);

      if (response.status === 403 && rateLimit.remaining === 0) {
        handleRateLimit(response, rateLimit);
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new GitHubSearchError(
          `GitHub API error: ${response.status} ${response.statusText}`,
          'API_ERROR',
          { status: response.status }
        );
      }

      const data = (await response.json()) as GitHubRepoDetail;
      return mapToGitHubRepo(data);
    } catch (error) {
      if (error instanceof GitHubSearchError) throw error;
      // Network errors throw for individual repo fetch
      throw new GitHubSearchError(
        `Failed to fetch repository ${owner}/${name}`,
        'NETWORK_ERROR',
        { cause: error instanceof Error ? error.message : String(error) }
      );
    }
  },

  /**
   * Get repository README content
   *
   * @param owner - Repository owner login
   * @param name - Repository name
   * @returns README markdown content or null if not found
   */
  async getReadme(owner: string, name: string): Promise<string | null> {
    // Try common README filenames
    const readmeNames = ['README.md', 'README.markdown', 'README.txt', 'README'];

    for (const readmeName of readmeNames) {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${name}/readme/${readmeName}`;

      try {
        const response = await fetchWithTimeout(url, {
          headers: {
            ...buildHeaders(),
            Accept: 'application/vnd.github.v3.raw',
          },
        }, REQUEST_TIMEOUT);

        if (response.ok) {
          return await response.text();
        }

        if (response.status === 404) {
          continue; // Try next filename
        }

        if (response.status === 403) {
          const rateLimit = parseRateLimit(response.headers);
          if (rateLimit.remaining === 0) {
            handleRateLimit(response, rateLimit);
          }
        }

        // Other errors: break and return null
        break;
      } catch (error) {
        if (error instanceof GitHubSearchError) throw error;
        // Network errors: try next filename
        continue;
      }
    }

    return null;
  },
};

/**
 * Service interface for dependency injection and testing
 */
export interface GitHubSearchService {
  searchRepositories(query: string, options?: SearchOptions): Promise<GitHubRepo[]>;
  getRepository(owner: string, name: string): Promise<GitHubRepo | null>;
  getReadme(owner: string, name: string): Promise<string | null>;
}

// Export default instance
export default gitHubSearchService;
