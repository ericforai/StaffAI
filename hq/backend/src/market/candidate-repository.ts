/**
 * Candidate Repository
 *
 * Manages storage and retrieval of candidate projects discovered through
 * external search (GitHub, npm, etc.). Provides deduplication based on
 * repository URLs to prevent redundant entries.
 *
 * @module market/candidate-repository
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Candidate evaluation result
 */
export interface CandidateEvaluation {
  score: number; // 0-100
  rating: 'recommended' | 'consider' | 'not-recommended';
  tier: 'excellent' | 'good' | 'fair' | 'poor';
  strengths: string[];
  concerns: string[];
  evaluatedAt: string;
}

/**
 * Candidate professional capability
 */
export interface CandidateCapability {
  category: string; // engineering, design, marketing, etc.
  specialties: string[];
  description: string;
  skills: string[];
}

/**
 * Import information for imported candidates
 */
export interface ImportedAs {
  employeeId: string;
  importedAt: string;
}

/**
 * A candidate project discovered through external search
 */
export interface Candidate {
  /** Unique candidate identifier */
  id: string;
  /** Source platform ('github', 'npm', etc.) */
  source: 'github' | 'npm' | 'pypi' | 'custom';
  /** Repository URL (used for deduplication) */
  url: string;
  /** Repository owner/org */
  owner: string;
  /** Repository/project name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Primary programming language */
  language?: string;
  /** Quality indicators (stars, downloads, etc.) */
  score: {
    stars?: number;
    forks?: number;
    downloads?: number;
    lastUpdated: string; // ISO 8601
  };
  /** Tags/topics for categorization */
  topics: string[];
  /** Evaluation result */
  evaluation?: CandidateEvaluation;
  /** Professional capability */
  capability?: CandidateCapability;
  /** Candidate status */
  status: 'candidate' | 'observing' | 'imported' | 'removed';
  /** Observation notes */
  observeNotes?: string;
  /** When observation started */
  observedAt?: string;
  /** Import information (when status=imported) */
  importedAs?: ImportedAs;
  /** Timestamp when candidate was added */
  createdAt: string;
  /** Timestamp when candidate was last updated */
  updatedAt: string;
}

/**
 * Options for listing candidates
 */
export interface ListCandidatesOptions {
  /** Filter by source platform */
  source?: Candidate['source'];
  /** Filter by language */
  language?: string;
  /** Minimum star count */
  minStars?: number;
  /** Filter by topic tags */
  topics?: string[];
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Repository interface for candidate storage and retrieval
 */
export interface CandidateRepository {
  /**
   * List all candidates with optional filtering
   */
  list(options?: ListCandidatesOptions): Promise<Candidate[]>;

  /**
   * Get a candidate by ID
   */
  getById(id: string): Promise<Candidate | null>;

  /**
   * Find a candidate by repository URL
   */
  getByUrl(url: string): Promise<Candidate | null>;

  /**
   * Add a new candidate (deduplicates by URL)
   * Returns the existing candidate if URL already exists
   */
  add(candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Candidate>;

  /**
   * Update an existing candidate
   */
  update(
    id: string,
    updater: (candidate: Candidate) => Candidate
  ): Promise<Candidate | null>;

  /**
   * Delete a candidate
   */
  delete(id: string): Promise<boolean>;

  /**
   * Add multiple candidates in batch (with deduplication)
   * Returns array of (new candidates + existing matches)
   */
  addBatch(
    candidates: Array<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Candidate[]>;
}

// =============================================================================
// File-based Implementation
// =============================================================================

/**
 * Generate a unique candidate ID
 */
function generateId(): string {
  return `candidate_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Read JSON file with fallback (async)
 */
async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const fs = await import('node:fs/promises');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return fallback;
      }
      throw error;
    }
  } catch {
    return fallback;
  }
}

/**
 * Write JSON file atomically (async)
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Normalize URL for deduplication comparison
 * - Removes trailing slashes
 * - Converts to lowercase
 * - Removes .git suffix
 */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
}

/**
 * Filter candidates by options
 */
function filterCandidates(
  candidates: Candidate[],
  options?: ListCandidatesOptions
): Candidate[] {
  let filtered = [...candidates];

  if (options?.source) {
    filtered = filtered.filter((c) => c.source === options.source);
  }

  if (options?.language) {
    filtered = filtered.filter((c) =>
      c.language?.toLowerCase().includes(options.language!.toLowerCase())
    );
  }

  if (options?.minStars !== undefined) {
    filtered = filtered.filter((c) => (c.score.stars ?? 0) >= options.minStars!);
  }

  if (options?.topics && options.topics.length > 0) {
    filtered = filtered.filter((c) =>
      options.topics!.some((topic) => c.topics.includes(topic))
    );
  }

  // Sort by stars (descending) and last updated
  filtered.sort((a, b) => {
    const aStars = a.score.stars ?? 0;
    const bStars = b.score.stars ?? 0;
    if (bStars !== aStars) return bStars - aStars;
    return (
      new Date(b.score.lastUpdated).getTime() -
      new Date(a.score.lastUpdated).getTime()
    );
  });

  // Apply pagination
  const offset = options?.offset ?? 0;
  const limit = options?.limit;
  if (limit !== undefined) {
    filtered = filtered.slice(offset, offset + limit);
  } else if (offset > 0) {
    filtered = filtered.slice(offset);
  }

  return filtered;
}

/**
 * Create a file-based candidate repository
 *
 * @param filePath - Path to JSON file for persistence
 * @returns CandidateRepository instance
 */
export function createFileCandidateRepository(
  filePath: string
): CandidateRepository {
  return {
    async list(options?: ListCandidatesOptions): Promise<Candidate[]> {
      const candidates = await readJsonFile<Candidate[]>(filePath, []);
      return filterCandidates(candidates, options);
    },

    async getById(id: string): Promise<Candidate | null> {
      const candidates = await readJsonFile<Candidate[]>(filePath, []);
      return candidates.find((c) => c.id === id) ?? null;
    },

    async getByUrl(url: string): Promise<Candidate | null> {
      const candidates = await readJsonFile<Candidate[]>(filePath, []);
      const normalized = normalizeUrl(url);
      return candidates.find((c) => normalizeUrl(c.url) === normalized) ?? null;
    },

    async add(
      candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Candidate> {
      const candidates = await readJsonFile<Candidate[]>(filePath, []);
      const normalizedUrl = normalizeUrl(candidate.url);

      // Check for existing candidate with same URL
      const existing = candidates.find(
        (c) => normalizeUrl(c.url) === normalizedUrl
      );

      if (existing) {
        // Update existing candidate with new data
        const now = new Date().toISOString();
        const updated: Candidate = {
          ...existing,
          description: candidate.description ?? existing.description,
          language: candidate.language ?? existing.language,
          score: { ...candidate.score },
          topics: Array.from(new Set([...existing.topics, ...candidate.topics])),
          updatedAt: now,
        };

        const index = candidates.findIndex((c) => c.id === existing.id);
        candidates[index] = updated;
        await writeJsonFile(filePath, candidates);
        return updated;
      }

      // Create new candidate
      const now = new Date().toISOString();
      const newCandidate: Candidate = {
        ...candidate,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };

      candidates.push(newCandidate);
      await writeJsonFile(filePath, candidates);
      return newCandidate;
    },

    async update(
      id: string,
      updater: (candidate: Candidate) => Candidate
    ): Promise<Candidate | null> {
      const candidates = await readJsonFile<Candidate[]>(filePath, []);
      const index = candidates.findIndex((c) => c.id === id);

      if (index < 0) {
        return null;
      }

      const updated = updater(candidates[index]);
      updated.updatedAt = new Date().toISOString();
      candidates[index] = updated;
      await writeJsonFile(filePath, candidates);
      return updated;
    },

    async delete(id: string): Promise<boolean> {
      const candidates = await readJsonFile<Candidate[]>(filePath, []);
      const index = candidates.findIndex((c) => c.id === id);

      if (index < 0) {
        return false;
      }

      candidates.splice(index, 1);
      await writeJsonFile(filePath, candidates);
      return true;
    },

    async addBatch(
      candidates: Array<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<Candidate[]> {
      const stored = await readJsonFile<Candidate[]>(filePath, []);
      const results: Candidate[] = [];
      const now = new Date().toISOString();

      for (const input of candidates) {
        const normalizedUrl = normalizeUrl(input.url);
        const existing = stored.find(
          (c) => normalizeUrl(c.url) === normalizedUrl
        );

        if (existing) {
          // Merge with existing
          const merged: Candidate = {
            ...existing,
            description: input.description ?? existing.description,
            language: input.language ?? existing.language,
            score: { ...input.score },
            topics: Array.from(new Set([...existing.topics, ...input.topics])),
            updatedAt: now,
          };
          const index = stored.findIndex((c) => c.id === existing.id);
          stored[index] = merged;
          results.push(merged);
        } else {
          // Create new
          const newCandidate: Candidate = {
            ...input,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          };
          stored.push(newCandidate);
          results.push(newCandidate);
        }
      }

      await writeJsonFile(filePath, stored);
      return results;
    },
  };
}

// =============================================================================
// In-Memory Implementation (for testing)
// =============================================================================

/**
 * Create an in-memory candidate repository
 *
 * @param seed - Initial candidates (optional)
 * @returns CandidateRepository instance
 */
export function createInMemoryCandidateRepository(
  seed: Candidate[] = []
): CandidateRepository {
  const candidates: Candidate[] = [...seed];

  return {
    async list(options?: ListCandidatesOptions): Promise<Candidate[]> {
      return filterCandidates(candidates, options);
    },

    async getById(id: string): Promise<Candidate | null> {
      return candidates.find((c) => c.id === id) ?? null;
    },

    async getByUrl(url: string): Promise<Candidate | null> {
      const normalized = normalizeUrl(url);
      return candidates.find((c) => normalizeUrl(c.url) === normalized) ?? null;
    },

    async add(
      candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Candidate> {
      const normalizedUrl = normalizeUrl(candidate.url);
      const existing = candidates.find(
        (c) => normalizeUrl(c.url) === normalizedUrl
      );

      if (existing) {
        const now = new Date().toISOString();
        const updated: Candidate = {
          ...existing,
          description: candidate.description ?? existing.description,
          language: candidate.language ?? existing.language,
          score: { ...candidate.score },
          topics: Array.from(new Set([...existing.topics, ...candidate.topics])),
          updatedAt: now,
        };
        const index = candidates.findIndex((c) => c.id === existing.id);
        candidates[index] = updated;
        return updated;
      }

      const now = new Date().toISOString();
      const newCandidate: Candidate = {
        ...candidate,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      candidates.push(newCandidate);
      return newCandidate;
    },

    async update(
      id: string,
      updater: (candidate: Candidate) => Candidate
    ): Promise<Candidate | null> {
      const index = candidates.findIndex((c) => c.id === id);
      if (index < 0) {
        return null;
      }
      const updated = updater(candidates[index]);
      updated.updatedAt = new Date().toISOString();
      candidates[index] = updated;
      return updated;
    },

    async delete(id: string): Promise<boolean> {
      const index = candidates.findIndex((c) => c.id === id);
      if (index < 0) {
        return false;
      }
      candidates.splice(index, 1);
      return true;
    },

    async addBatch(
      inputs: Array<Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<Candidate[]> {
      const results: Candidate[] = [];
      const now = new Date().toISOString();

      for (const input of inputs) {
        const normalizedUrl = normalizeUrl(input.url);
        const existing = candidates.find(
          (c) => normalizeUrl(c.url) === normalizedUrl
        );

        if (existing) {
          const merged: Candidate = {
            ...existing,
            description: input.description ?? existing.description,
            language: input.language ?? existing.language,
            score: { ...input.score },
            topics: Array.from(new Set([...existing.topics, ...input.topics])),
            updatedAt: now,
          };
          const index = candidates.findIndex((c) => c.id === existing.id);
          candidates[index] = merged;
          results.push(merged);
        } else {
          const newCandidate: Candidate = {
            ...input,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          };
          candidates.push(newCandidate);
          results.push(newCandidate);
        }
      }

      return results;
    },
  };
}
