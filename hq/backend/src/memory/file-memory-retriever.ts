/**
 * File Memory Retriever Implementation
 *
 * Provides memory retrieval functionality from the filesystem .ai/ directory.
 * Implements the MemoryRetriever interface with caching and type-weighted scoring.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  indexMemoryDocuments,
  filterDocumentsByType,
  filterDocumentsByDateRange,
  type MemoryDocument,
} from './memory-indexer';
import { DisabledEmbedder, HashingEmbedder, cosineSimilarity, type Embedder } from './retrieval/embedding';
import { appendUsageLogEvent } from './retrieval/usage-logger';
import {
  type MemoryRetriever,
  type MemoryContext,
  type RetrieveOptions,
  type RetrievalResult,
  type MemoryDocumentType,
  type MemoryRetrieverConfig,
  MEMORY_DIRECTORY_MAP,
  MEMORY_TYPE_WEIGHTS,
} from './memory-retriever-types';

/**
 * Cached retrieval entry with expiration
 */
interface CacheEntry {
  result: RetrievalResult;
  expiresAt: number;
}

type ScoredDocument = { document: MemoryDocument; score: number; lexicalScore: number; vectorScore?: number };

/**
 * File-based implementation of MemoryRetriever
 */
export class FileMemoryRetriever implements MemoryRetriever {
  private readonly memoryRootDir: string;
  private readonly cacheTtlMs: number;
  private readonly enableCache: boolean;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly enableVectorRerank: boolean;
  private readonly vectorWeight: number;
  private readonly rerankTopK?: number;
  private readonly embedder: Embedder;
  private readonly enableUsageLogs: boolean;
  private readonly usageLogPath: string;

  constructor(config: MemoryRetrieverConfig) {
    this.memoryRootDir = config.memoryRootDir;
    this.cacheTtlMs = config.cacheTtlMs ?? 300000; // 5 minutes default
    this.enableCache = config.enableCache ?? true;
    this.enableVectorRerank = config.enableVectorRerank ?? false;
    this.vectorWeight = config.vectorWeight ?? 0;
    this.rerankTopK = config.rerankTopK;
    this.embedder = this.enableVectorRerank ? new HashingEmbedder(512) : new DisabledEmbedder();
    this.enableUsageLogs = config.enableUsageLogs ?? false;
    this.usageLogPath = config.usageLogPath ?? path.join(this.memoryRootDir, 'usage', 'retrieval.jsonl');
  }

  /**
   * Retrieve memory context relevant to a specific task
   */
  async retrieveForTask(query: string, taskId: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);
    const cacheKey = this.buildCacheKey('task', taskId, query, opts);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    if (!fs.existsSync(this.memoryRootDir)) {
      return this.emptyResult(query);
    }

    const allDocuments = indexMemoryDocuments(this.memoryRootDir);
    const taskDocuments = this.filterTaskDocuments(allDocuments, taskId);

    if (taskDocuments.length === 0) {
      // Fall back to general retrieval if no task-specific documents
      return this.retrieveInternal(query, allDocuments, opts);
    }

    const result = this.retrieveInternal(query, taskDocuments, opts);
    this.setToCache(cacheKey, result);
    return result;
  }

  /**
   * Retrieve general project context
   */
  async retrieveProjectContext(query?: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);
    const searchQuery = query ?? '';
    const cacheKey = this.buildCacheKey('project', '', searchQuery, opts);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    if (!fs.existsSync(this.memoryRootDir)) {
      return this.emptyResult(searchQuery);
    }

    const documents = indexMemoryDocuments(this.memoryRootDir);
    const result = this.retrieveInternal(searchQuery, documents, opts);
    this.setToCache(cacheKey, result);
    return result;
  }

  /**
   * Retrieve decision records matching a query
   */
  async retrieveDecisions(query: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);
    const cacheKey = this.buildCacheKey('decisions', '', query, opts);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    if (!fs.existsSync(this.memoryRootDir)) {
      return this.emptyResult(query);
    }

    const allDocuments = indexMemoryDocuments(this.memoryRootDir);
    const decisionDocuments = filterDocumentsByType(allDocuments, 'decisions');

    if (decisionDocuments.length === 0) {
      return this.emptyResult(query);
    }

    const result = this.retrieveInternal(query, decisionDocuments, opts);
    this.setToCache(cacheKey, result);
    return result;
  }

  /**
   * Retrieve agent-specific memory context
   */
  async retrieveAgentContext(agentId: string, query?: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);
    const searchQuery = query ?? '';
    const cacheKey = this.buildCacheKey('agent', agentId, searchQuery, opts);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    if (!fs.existsSync(this.memoryRootDir)) {
      return this.emptyResult(searchQuery);
    }

    const allDocuments = indexMemoryDocuments(this.memoryRootDir);
    const agentDocuments = allDocuments.filter((doc) =>
      doc.relativePath.includes(agentId)
    );

    if (agentDocuments.length === 0) {
      return this.emptyResult(searchQuery);
    }

    const result = this.retrieveInternal(searchQuery, agentDocuments, opts);
    this.setToCache(cacheKey, result);
    return result;
  }

  /**
   * Retrieve knowledge base entries
   */
  async retrieveKnowledge(query: string, domain?: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);
    const domainSuffix = domain ?? '';
    const cacheKey = this.buildCacheKey('knowledge', domainSuffix, query, opts);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    if (!fs.existsSync(this.memoryRootDir)) {
      return this.emptyResult(query);
    }

    const allDocuments = indexMemoryDocuments(this.memoryRootDir);
    const knowledgeDocuments = this.filterKnowledgeDocuments(allDocuments, domain);

    const result = this.retrieveInternal(query, knowledgeDocuments, opts);
    this.setToCache(cacheKey, result);
    return result;
  }

  /**
   * General retrieval across all memory types
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<RetrievalResult> {
    const opts = this.normalizeOptions(options);
    const cacheKey = this.buildCacheKey('general', '', query, opts);

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    if (!fs.existsSync(this.memoryRootDir)) {
      return this.emptyResult(query);
    }

    const documents = indexMemoryDocuments(this.memoryRootDir);
    const result = this.retrieveInternal(query, documents, opts);
    this.setToCache(cacheKey, result);
    return result;
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Internal retrieval implementation
   */
  private retrieveInternal(
    query: string,
    documents: MemoryDocument[],
    options: Required<RetrieveOptions>
  ): RetrievalResult {
    const t0 = Date.now();
    const filtered = this.filterDocuments(documents, options);
    const t1 = Date.now();
    const scored = this.scoreDocuments(query, filtered).map((entry) => ({
      ...entry,
      lexicalScore: entry.score,
    }));
    const t2 = Date.now();
    const reranked = this.rerankIfEnabled(query, scored, options);
    const t3 = Date.now();
    const sorted = this.sortAndLimit(reranked, options);
    const entries = this.buildEntries(sorted, options);
    const context = this.buildContextString(entries, options);
    const t4 = Date.now();

    const result: RetrievalResult = {
      entries,
      context,
      metadata: this.buildMetadata(query, documents.length, entries.length),
    };

    if (this.enableUsageLogs) {
      try {
        appendUsageLogEvent(this.usageLogPath, {
          ts: new Date().toISOString(),
          retriever: 'file',
          strategy: this.enableVectorRerank ? `lexical+${this.embedder.name}` : 'lexical',
          query,
          options: {
            limit: options.limit,
            threshold: options.threshold,
            includeFullContent: options.includeFullContent,
            documentTypes: options.documentTypes,
            excerptMaxChars: options.excerptMaxChars,
            contextMaxChars: options.contextMaxChars,
            fallbackMode: options.fallbackMode,
          },
          totalDocuments: documents.length,
          candidateCount: scored.length,
          selectedCount: entries.length,
          timingMs: {
            filter: t1 - t0,
            score: t2 - t1,
            rerank: t3 - t2,
            build: t4 - t3,
          },
          selected: entries.map((entry) => ({
            relativePath: entry.relativePath,
            type: entry.type,
            lexicalScore: entry.score,
            finalScore: entry.score,
          })),
        });
      } catch {
        // Swallow logging errors — retrieval must not fail.
      }
    }

    return result;
  }

  private rerankIfEnabled(
    query: string,
    scored: ScoredDocument[],
    options: Required<RetrieveOptions>,
  ): ScoredDocument[] {
    if (!this.enableVectorRerank || this.vectorWeight <= 0) {
      return scored;
    }
    const queryVec = this.embedder.embed(query);
    if (!queryVec) {
      return scored;
    }

    const sortedLexical = scored.slice().sort((a, b) => b.lexicalScore - a.lexicalScore);
    const topK = this.rerankTopK ?? Math.max(options.limit * 10, 50);
    const head = sortedLexical.slice(0, topK);
    const tail = sortedLexical.slice(topK);

    const rerankedHead = head
      .map((entry) => {
        const docVec = this.embedder.embed(entry.document.content);
        const vectorScore = docVec ? cosineSimilarity(queryVec, docVec) : 0;
        const finalScore = entry.lexicalScore + this.vectorWeight * vectorScore;
        return { entry, finalScore, vectorScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .map(({ entry, finalScore, vectorScore }) => ({ ...entry, score: finalScore, vectorScore }));

    return [...rerankedHead, ...tail];
  }

  /**
   * Normalize options with defaults
   */
  private normalizeOptions(options?: RetrieveOptions): Required<RetrieveOptions> {
    return {
      limit: options?.limit ?? 3,
      threshold: options?.threshold ?? 0,
      includeFullContent: options?.includeFullContent ?? false,
      documentTypes: options?.documentTypes ?? [],
      timeRange: options?.timeRange ?? { start: new Date(0), end: new Date() },
      excerptMaxChars: options?.excerptMaxChars ?? 300,
      contextMaxChars: options?.contextMaxChars ?? 1600,
      fallbackMode: options?.fallbackMode ?? 'recent',
    };
  }

  /**
   * Build cache key from parameters
   */
  private buildCacheKey(
    type: string,
    scope: string,
    query: string,
    options: Required<RetrieveOptions>
  ): string {
    const parts = [
      type,
      scope,
      query,
      options.limit,
      options.threshold,
      options.includeFullContent,
      options.documentTypes?.join(',') ?? '',
      options.timeRange?.start.getTime() ?? '',
      options.timeRange?.end.getTime() ?? '',
      options.excerptMaxChars,
      options.contextMaxChars,
      options.fallbackMode,
    ];
    return parts.join(':');
  }

  /**
   * Get cached result if not expired
   */
  private getFromCache(key: string): RetrievalResult | null {
    if (!this.enableCache) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Set result in cache with expiration
   */
  private setToCache(key: string, result: RetrievalResult): void {
    if (!this.enableCache) {
      return;
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Filter documents by options
   */
  private filterDocuments(documents: MemoryDocument[], options: Required<RetrieveOptions>): MemoryDocument[] {
    let filtered = documents;

    // Filter by document type
    if (options.documentTypes && options.documentTypes.length > 0) {
      filtered = filtered.filter((doc) => {
        const docType = this.inferDocumentType(doc.relativePath);
        return options.documentTypes!.includes(docType);
      });
    }

    // Filter by time range
    if (options.timeRange) {
      const startMs = options.timeRange.start.getTime();
      const endMs = options.timeRange.end.getTime();
      filtered = filterDocumentsByDateRange(filtered, startMs, endMs);
    }

    return filtered;
  }

  /**
   * Filter documents for a specific task
   */
  private filterTaskDocuments(documents: MemoryDocument[], taskId: string): MemoryDocument[] {
    return documents.filter((doc) =>
      doc.relativePath.includes(taskId) || doc.relativePath.startsWith('tasks/')
    );
  }

  /**
   * Filter knowledge documents by domain
   */
  private filterKnowledgeDocuments(documents: MemoryDocument[], domain?: string): MemoryDocument[] {
    let filtered = documents.filter((doc) =>
      doc.relativePath.startsWith('knowledge/') || doc.relativePath.includes('/knowledge/')
    );

    if (domain) {
      filtered = filtered.filter((doc) =>
        doc.relativePath.toLowerCase().includes(domain.toLowerCase())
      );
    }

    return filtered;
  }

  /**
   * Score documents by query relevance
   */
  private scoreDocuments(query: string, documents: MemoryDocument[]): Array<{ document: MemoryDocument; score: number }> {
    if (query.trim().length === 0) {
      // No query: return all with zero score
      return documents.map((document) => ({ document, score: 0 }));
    }

    const queryTokens = this.getTokenSet(query);
    const orderedQueryTokens = this.getTokenList(query);

    return documents.map((document) => {
      const baseScore = this.scoreDocument(document, queryTokens, orderedQueryTokens);
      const typeWeight = MEMORY_TYPE_WEIGHTS[this.inferDocumentType(document.relativePath)] ?? 1.0;
      return {
        document,
        score: baseScore * typeWeight,
      };
    });
  }

  /**
   * Score a single document against query tokens
   */
  private scoreDocument(document: MemoryDocument, queryTokens: Set<string>, orderedQueryTokens: string[]): number {
    const documentTokens = this.getTokenSet(document.content);
    const termFrequency = this.buildTermFrequency(this.getTokenList(document.content));
    const normalizedContent = document.content.toLowerCase().replace(/\s+/g, ' ');
    const normalizedPath = document.relativePath.toLowerCase();

    let score = 0;
    let matchedUnique = 0;

    const queryTokenArray = Array.from(queryTokens);
    for (const token of queryTokenArray) {
      if (documentTokens.has(token)) {
        matchedUnique += 1;
        const tf = termFrequency.get(token) ?? 1;
        score += 2 + Math.log2(1 + tf);
        if (normalizedPath.includes(token)) {
          score += 1.25;
        }
      }
    }

    if (queryTokens.size > 0) {
      const coverage = matchedUnique / queryTokens.size;
      score += coverage * 5;
    }

    score += this.countQueryBigramsInContent(orderedQueryTokens, normalizedContent) * 1.8;
    return Number(score.toFixed(4));
  }

  /**
   * Sort and limit results
   */
  private sortAndLimit(
    scored: Array<{ document: MemoryDocument; score: number }>,
    options: Required<RetrieveOptions>
  ): Array<{ document: MemoryDocument; score: number }> {
    const threshold = options.threshold;

    // Sort by score descending, then by date descending
    const sorted = scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.document.modifiedAtMs - left.document.modifiedAtMs;
    });

    // Filter by threshold - require positive score when threshold is 0
    // This means we only return documents that actually matched something
    const effectiveThreshold = threshold === 0 ? 0.001 : threshold;
    const aboveThreshold = sorted.filter((item) => item.score >= effectiveThreshold);

    // If no matches and conditions are right, use fallback
    // Only fallback if: threshold was 0 (default), no matches, and mode is 'recent'
    const shouldFallback = aboveThreshold.length === 0 &&
                           threshold === 0 &&
                           options.fallbackMode === 'recent';

    if (shouldFallback) {
      return sorted.slice(0, options.limit);
    }

    return aboveThreshold.slice(0, options.limit);
  }

  /**
   * Build MemoryContext entries
   */
  private buildEntries(
    scored: Array<{ document: MemoryDocument; score: number }>,
    options: Required<RetrieveOptions>
  ): MemoryContext[] {
    return scored.map((item) => ({
      relativePath: item.document.relativePath,
      type: this.inferDocumentType(item.document.relativePath),
      excerpt: this.toExcerpt(item.document.content, options.excerptMaxChars),
      fullContent: options.includeFullContent ? item.document.content : undefined,
      score: item.score,
      modifiedAtMs: item.document.modifiedAtMs,
    }));
  }

  /**
   * Build formatted context string
   */
  private buildContextString(entries: MemoryContext[], options: Required<RetrieveOptions>): string {
    const sections: string[] = [];
    let usedChars = 0;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const header = `#${index + 1} ${entry.relativePath}\n`;
      const section = `${header}${entry.excerpt}`;
      const separator = sections.length > 0 ? '\n\n' : '';
      const projectedLength = usedChars + separator.length + section.length;

      if (projectedLength <= options.contextMaxChars) {
        sections.push(section);
        usedChars = projectedLength;
        continue;
      }

      const remaining = options.contextMaxChars - usedChars - separator.length - header.length;
      if (remaining <= 16) {
        break;
      }

      const trimmedExcerpt = this.toExcerpt(entry.excerpt, remaining);
      const trimmedSection = `${header}${trimmedExcerpt}`;
      sections.push(trimmedSection);
      break;
    }

    return sections.join('\n\n');
  }

  /**
   * Build metadata object
   */
  private buildMetadata(query: string, totalDocuments: number, matchedDocuments: number): RetrievalResult['metadata'] {
    return {
      query,
      totalDocuments,
      matchedDocuments,
      types: {
        project: 0,
        task: 0,
        decision: 0,
        knowledge: 0,
        agent: 0,
      },
    };
  }

  /**
   * Infer document type from relative path
   */
  private inferDocumentType(relativePath: string): MemoryDocumentType {
    const normalized = relativePath.toLowerCase();

    if (normalized.startsWith('context/') || normalized.includes('/context/')) {
      return 'project';
    }
    if (normalized.startsWith('tasks/') || normalized.includes('/tasks/') || normalized.startsWith('task-summaries')) {
      return 'task';
    }
    if (normalized.startsWith('decisions/') || normalized.includes('/decisions/')) {
      return 'decision';
    }
    if (normalized.startsWith('knowledge/') || normalized.includes('/knowledge/')) {
      return 'knowledge';
    }
    if (normalized.startsWith('agents/') || normalized.includes('/agents/')) {
      return 'agent';
    }

    return 'project'; // Default
  }

  /**
   * Create empty result
   */
  private emptyResult(query: string): RetrievalResult {
    return {
      entries: [],
      context: '',
      metadata: {
        query,
        totalDocuments: 0,
        matchedDocuments: 0,
        types: {
          project: 0,
          task: 0,
          decision: 0,
          knowledge: 0,
          agent: 0,
        },
      },
    };
  }

  /**
   * Tokenization utilities
   */
  private getTokenSet(text: string): Set<string> {
    const tokens = text
      .toLowerCase()
      .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
      .filter((token) => token.length >= 2);
    return new Set(tokens);
  }

  private getTokenList(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
      .filter((token) => token.length >= 2);
  }

  private buildTermFrequency(tokens: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const token of tokens) {
      map.set(token, (map.get(token) ?? 0) + 1);
    }
    return map;
  }

  private countQueryBigramsInContent(queryTokens: string[], normalizedDocumentContent: string): number {
    if (queryTokens.length < 2) {
      return 0;
    }

    let count = 0;
    for (let index = 0; index < queryTokens.length - 1; index += 1) {
      const bigram = `${queryTokens[index]} ${queryTokens[index + 1]}`;
      if (normalizedDocumentContent.includes(bigram)) {
        count += 1;
      }
    }
    return count;
  }

  private toExcerpt(content: string, maxLength: number = 300): string {
    const compact = content.replace(/\s+/g, ' ').trim();
    if (compact.length <= maxLength) {
      return compact;
    }
    if (maxLength <= 3) {
      return '.'.repeat(Math.max(maxLength, 0));
    }
    return `${compact.slice(0, maxLength - 3)}...`;
  }
}

/**
 * Factory function to create a FileMemoryRetriever
 */
export function createMemoryRetriever(config: MemoryRetrieverConfig): FileMemoryRetriever {
  return new FileMemoryRetriever(config);
}
