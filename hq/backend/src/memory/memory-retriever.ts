import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';
import type { MemoryDocumentType } from './memory-layout';
import {
  indexMemoryDocuments,
  filterDocumentsByType,
  filterDocumentsByDateRange,
  type MemoryDocument,
} from './memory-indexer';

export interface RetrievedMemoryContext {
  entries: Array<{
    relativePath: string;
    excerpt: string;
    score: number;
  }>;
  context: string;
}

function getTokenSet(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
    .filter((token) => token.length >= 2);
  return new Set(tokens);
}

function getTokenList(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，.。!！?？:：;；/\\()[\]{}<>"'`~|@#$%^&*+=_-]+/)
    .filter((token) => token.length >= 2);
}

function countQueryBigramsInContent(queryTokens: string[], normalizedDocumentContent: string): number {
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

function buildTermFrequency(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function scoreDocument(document: MemoryDocument, queryTokens: Set<string>, orderedQueryTokens: string[]): number {
  const documentTokens = getTokenSet(document.content);
  const termFrequency = buildTermFrequency(getTokenList(document.content));
  const normalizedContent = document.content.toLowerCase().replace(/\s+/g, ' ');
  const normalizedPath = document.relativePath.toLowerCase();

  let score = 0;
  let matchedUnique = 0;
  const queryTokenArray = Array.from(queryTokens);
  for (const token of queryTokenArray) {
    if (documentTokens.has(token)) {
      matchedUnique += 1;
      const tf = termFrequency.get(token) || 1;
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

  score += countQueryBigramsInContent(orderedQueryTokens, normalizedContent) * 1.8;
  return Number(score.toFixed(4));
}

function toExcerpt(content: string, maxLength: number = 300): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  if (maxLength <= 3) {
    return '.'.repeat(Math.max(maxLength, 0));
  }
  return `${compact.slice(0, maxLength - 3)}...`;
}

export function retrieveMemoryContext(
  query: string,
  options: {
    memoryRootDir: string;
    limit?: number;
    excerptMaxChars?: number;
    contextMaxChars?: number;
    fallbackMode?: 'none' | 'recent';
    useCache?: boolean;
    /** Optional: filter to specific document types */
    documentTypes?: MemoryDocumentType[];
  }
): RetrievedMemoryContext {
  const {
    memoryRootDir,
    limit = 3,
    excerptMaxChars = 300,
    contextMaxChars = 1600,
    fallbackMode = 'recent',
    useCache = false,
    documentTypes,
  } = options;

  if (useCache) {
    const cacheKey = `${memoryRootDir}:${query}:${limit}:${excerptMaxChars}:${contextMaxChars}:${documentTypes?.join(',') ?? 'all'}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }
  const queryTokens = getTokenSet(query);
  const orderedQueryTokens = getTokenList(query);

  if (!fs.existsSync(memoryRootDir)) {
    return {
      entries: [],
      context: '',
    };
  }

  const documents = indexMemoryDocuments(memoryRootDir, { documentTypes });
  if (documents.length === 0) {
    return {
      entries: [],
      context: '',
    };
  }

  if (queryTokens.size === 0) {
    return {
      entries: [],
      context: '',
    };
  }

  const ranked = documents
    .map((document) => ({
      document,
      score: scoreDocument(document, queryTokens, orderedQueryTokens),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.document.modifiedAtMs - left.document.modifiedAtMs;
    });

  const matched = ranked.filter((item) => item.score > 0).slice(0, limit);
  const selected =
    matched.length > 0
      ? matched
      : fallbackMode === 'recent'
        ? documents
            .slice()
            .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
            .slice(0, limit)
            .map((document) => ({ document, score: 0 }))
        : [];

  const baseEntries = selected.map((item) => ({
    relativePath: item.document.relativePath,
    excerpt: toExcerpt(item.document.content, excerptMaxChars),
    score: item.score,
  }));

  const entries: RetrievedMemoryContext['entries'] = [];
  const contextSections: string[] = [];
  let usedChars = 0;

  for (let index = 0; index < baseEntries.length; index += 1) {
    const entry = baseEntries[index];
    const header = `#${index + 1} ${entry.relativePath}\n`;
    const section = `${header}${entry.excerpt}`;
    const separator = contextSections.length > 0 ? '\n\n' : '';
    const projectedLength = usedChars + separator.length + section.length;

    if (projectedLength <= contextMaxChars) {
      contextSections.push(section);
      entries.push(entry);
      usedChars = projectedLength;
      continue;
    }

    const remaining = contextMaxChars - usedChars - separator.length - header.length;
    if (remaining <= 16) {
      break;
    }

    const trimmedExcerpt = toExcerpt(entry.excerpt, remaining);
    const trimmedSection = `${header}${trimmedExcerpt}`;
    contextSections.push(trimmedSection);
    entries.push({
      ...entry,
      excerpt: trimmedExcerpt,
    });
    break;
  }

  const context = contextSections.join('\n\n');

  const result: RetrievedMemoryContext = { entries, context };

  if (useCache) {
    const cacheKey = `${memoryRootDir}:${query}:${limit}:${excerptMaxChars}:${contextMaxChars}`;
    memoryCache.set(cacheKey, result);
  }

  return result;
}

export function writeExecutionSummaryToMemory(
  task: Pick<TaskRecord, 'id' | 'title' | 'description' | 'executionMode'>,
  execution: Pick<ExecutionLifecycleRecord, 'id' | 'status' | 'executor' | 'outputSummary' | 'errorMessage'>,
  options: {
    memoryRootDir: string;
    now?: Date;
  }
): string {
  const now = options.now ?? new Date();
  const datePart = now.toISOString().slice(0, 10);
  const taskDir = path.join(options.memoryRootDir, 'task-summaries');
  fs.mkdirSync(taskDir, { recursive: true });

  const fileName = `${datePart}-${task.id}.md`;
  const filePath = path.join(taskDir, fileName);
  const lines = [
    `## Execution ${execution.id}`,
    '',
    `- Time: ${now.toISOString()}`,
    `- Task: ${task.title}`,
    `- Task ID: ${task.id}`,
    `- Mode: ${task.executionMode}`,
    `- Executor: ${execution.executor}`,
    `- Status: ${execution.status}`,
    '',
    '### Task Description',
    task.description,
    '',
    '### Result Summary',
    execution.outputSummary || execution.errorMessage || 'No summary captured.',
    '',
  ];

  fs.appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

const memoryCache = new Map<string, RetrievedMemoryContext>();

export function clearMemoryCache(): void {
  memoryCache.clear();
}

export function retrieveForTask(
  taskId: string,
  query: string,
  options: {
    memoryRootDir: string;
    limit?: number;
    excerptMaxChars?: number;
    contextMaxChars?: number;
    useCache?: boolean;
  }
): RetrievedMemoryContext {
  const { memoryRootDir, limit = 3, excerptMaxChars, contextMaxChars, useCache = false } = options;

  if (!fs.existsSync(memoryRootDir)) {
    return { entries: [], context: '' };
  }

  const allDocuments = indexMemoryDocuments(memoryRootDir);
  const taskDocuments = allDocuments.filter((doc) =>
    doc.relativePath.includes(taskId) || doc.relativePath.startsWith('task-summaries')
  );

  if (taskDocuments.length === 0) {
    return retrieveMemoryContext(query, { memoryRootDir, limit, excerptMaxChars, contextMaxChars });
  }

  const queryTokens = getTokenSet(query);
  const orderedQueryTokens = getTokenList(query);

  const ranked = taskDocuments
    .map((document) => ({
      document,
      score: scoreDocument(document, queryTokens, orderedQueryTokens),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.document.modifiedAtMs - left.document.modifiedAtMs;
    });

  const matched = ranked.filter((item) => item.score > 0).slice(0, limit);
  const selected = matched.length > 0 ? matched : taskDocuments.slice(0, limit).map((document) => ({ document, score: 0 }));

  const baseEntries = selected.map((item) => ({
    relativePath: item.document.relativePath,
    excerpt: toExcerpt(item.document.content, excerptMaxChars),
    score: item.score,
  }));

  const entries: RetrievedMemoryContext['entries'] = [];
  const contextSections: string[] = [];
  let usedChars = 0;
  const maxChars = contextMaxChars || 1600;

  for (let index = 0; index < baseEntries.length; index += 1) {
    const entry = baseEntries[index];
    const header = `#${index + 1} ${entry.relativePath}\n`;
    const section = `${header}${entry.excerpt}`;
    const separator = contextSections.length > 0 ? '\n\n' : '';
    const projectedLength = usedChars + separator.length + section.length;

    if (projectedLength <= maxChars) {
      contextSections.push(section);
      entries.push(entry);
      usedChars = projectedLength;
      continue;
    }

    const remaining = maxChars - usedChars - separator.length - header.length;
    if (remaining <= 16) {
      break;
    }

    const trimmedExcerpt = toExcerpt(entry.excerpt, remaining);
    const trimmedSection = `${header}${trimmedExcerpt}`;
    contextSections.push(trimmedSection);
    entries.push({
      ...entry,
      excerpt: trimmedExcerpt,
    });
    break;
  }

  const context = contextSections.join('\n\n');

  const result: RetrievedMemoryContext = { entries, context };

  if (useCache) {
    const cacheKey = `${memoryRootDir}:${query}:${limit}:${excerptMaxChars}:${contextMaxChars}`;
    memoryCache.set(cacheKey, result);
  }

  return result;
}

export function retrieveProjectContext(options: {
  memoryRootDir: string;
  limit?: number;
  excerptMaxChars?: number;
  contextMaxChars?: number;
}): RetrievedMemoryContext {
  const { memoryRootDir, limit = 5 } = options;

  if (!fs.existsSync(memoryRootDir)) {
    return { entries: [], context: '' };
  }

  const documents = indexMemoryDocuments(memoryRootDir);

  if (documents.length === 0) {
    return { entries: [], context: '' };
  }

  const sorted = documents.sort((a, b) => b.modifiedAtMs - a.modifiedAtMs).slice(0, limit);

  const entries = sorted.map((doc) => ({
    relativePath: doc.relativePath,
    excerpt: toExcerpt(doc.content, options.excerptMaxChars),
    score: 0,
  }));

  const contextSections = entries.map(
    (entry, index) => `#${index + 1} ${entry.relativePath}\n${entry.excerpt}`
  );

  let context = contextSections.join('\n\n');
  const maxChars = options.contextMaxChars || 1600;
  if (context.length > maxChars) {
    context = context.slice(0, maxChars - 3) + '...';
  }

  return { entries, context };
}

export function retrieveDecisions(
  query: string,
  options: {
    memoryRootDir: string;
    limit?: number;
    excerptMaxChars?: number;
    contextMaxChars?: number;
  }
): RetrievedMemoryContext {
  const { memoryRootDir, limit = 3 } = options;

  if (!fs.existsSync(memoryRootDir)) {
    return { entries: [], context: '' };
  }

  const allDocuments = indexMemoryDocuments(memoryRootDir);
  const decisionDocuments = filterDocumentsByType(allDocuments, 'decisions');

  if (decisionDocuments.length === 0) {
    return { entries: [], context: '' };
  }

  return retrieveMemoryContext(query, {
    ...options,
    memoryRootDir,
    limit,
  });
}

export function retrieveAgentContext(
  agentId: string,
  options: {
    memoryRootDir: string;
    limit?: number;
    excerptMaxChars?: number;
    contextMaxChars?: number;
  }
): RetrievedMemoryContext {
  const { memoryRootDir, limit = 3 } = options;

  if (!fs.existsSync(memoryRootDir)) {
    return { entries: [], context: '' };
  }

  const allDocuments = indexMemoryDocuments(memoryRootDir);
  const agentDocuments = allDocuments.filter((doc) =>
    doc.relativePath.includes(agentId)
  );

  if (agentDocuments.length === 0) {
    return { entries: [], context: '' };
  }

  const entries = agentDocuments.slice(0, limit).map((doc) => ({
    relativePath: doc.relativePath,
    excerpt: toExcerpt(doc.content, options.excerptMaxChars),
    score: 0,
  }));

  const contextSections = entries.map(
    (entry, index) => `#${index + 1} ${entry.relativePath}\n${entry.excerpt}`
  );

  let context = contextSections.join('\n\n');
  const maxChars = options.contextMaxChars || 1600;
  if (context.length > maxChars) {
    context = context.slice(0, maxChars - 3) + '...';
  }

  return { entries, context };
}

export function retrieveKnowledge(
  query: string,
  options: {
    memoryRootDir: string;
    limit?: number;
    excerptMaxChars?: number;
    contextMaxChars?: number;
  }
): RetrievedMemoryContext {
  return retrieveMemoryContext(query, options);
}
