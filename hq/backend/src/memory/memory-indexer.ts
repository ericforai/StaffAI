import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { MemoryDocumentType } from './memory-layout';
import { inferDocumentType } from './memory-layout';

export interface MemoryDocument {
  path: string;
  relativePath: string;
  content: string;
  modifiedAtMs: number;
  /** Document type inferred from path (PROJECT, TASK, DECISION, KNOWLEDGE, AGENT, SHARED) */
  documentType?: MemoryDocumentType;
}

export type DocumentCategory =
  | 'notes'
  | 'decisions'
  | 'playbooks'
  | 'agents'
  | 'meetings'
  | 'tasks'
  | 'other';

function walkMarkdownFiles(rootDir: string, baseDir: string, output: string[]) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(absolutePath, baseDir, output);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
      continue;
    }

    output.push(path.relative(baseDir, absolutePath));
  }
}

/**
 * Options for filtering documents during indexing.
 */
export interface IndexMemoryOptions {
  /** Only include documents of these types */
  documentTypes?: MemoryDocumentType[];
}

export function indexMemoryDocuments(
  memoryRootDir: string,
  options?: IndexMemoryOptions
): MemoryDocument[] {
  const files: string[] = [];
  walkMarkdownFiles(memoryRootDir, memoryRootDir, files);

  const documents = files.map((relativePath) => {
    const absolutePath = path.join(memoryRootDir, relativePath);
    const stat = fs.statSync(absolutePath);
    return {
      path: absolutePath,
      relativePath,
      content: fs.readFileSync(absolutePath, 'utf8'),
      modifiedAtMs: stat.mtimeMs,
      documentType: inferDocumentType(relativePath) ?? undefined,
    };
  });

  let result = documents.sort((a, b) => b.modifiedAtMs - a.modifiedAtMs);

  // Apply document type filtering if specified
  if (options?.documentTypes && options.documentTypes.length > 0) {
    result = result.filter((doc) =>
      doc.documentType !== undefined && options.documentTypes!.includes(doc.documentType)
    );
  }

  return result;
}

export function categorizeDocument(relativePath: string): DocumentCategory {
  const normalizedPath = relativePath.toLowerCase();

  if (normalizedPath.startsWith('notes') || normalizedPath.includes('/notes/')) {
    return 'notes';
  }
  if (normalizedPath.startsWith('decisions') || normalizedPath.includes('/decisions/')) {
    return 'decisions';
  }
  if (normalizedPath.startsWith('playbooks') || normalizedPath.includes('/playbooks/')) {
    return 'playbooks';
  }
  if (normalizedPath.startsWith('agents') || normalizedPath.includes('/agents/')) {
    return 'agents';
  }
  if (normalizedPath.startsWith('meetings') || normalizedPath.includes('/meetings/')) {
    return 'meetings';
  }
  if (
    normalizedPath.startsWith('task-summaries') ||
    normalizedPath.includes('/task-summaries/')
  ) {
    return 'tasks';
  }

  return 'other';
}

export function filterDocumentsByType(
  documents: MemoryDocument[],
  category: DocumentCategory
): MemoryDocument[] {
  if (documents.length === 0) {
    return [];
  }

  return documents.filter((doc) => categorizeDocument(doc.relativePath) === category);
}

export function filterDocumentsByDateRange(
  documents: MemoryDocument[],
  fromMs?: number,
  toMs?: number
): MemoryDocument[] {
  if (documents.length === 0) {
    return [];
  }

  return documents.filter((doc) => {
    if (fromMs !== undefined && doc.modifiedAtMs < fromMs) {
      return false;
    }
    if (toMs !== undefined && doc.modifiedAtMs > toMs) {
      return false;
    }
    return true;
  });
}

function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function deduplicateDocuments(documents: MemoryDocument[]): MemoryDocument[] {
  if (documents.length === 0) {
    return [];
  }

  const hashToDocuments = new Map<string, MemoryDocument>();

  for (const doc of documents) {
    const hash = computeContentHash(doc.content);
    const existing = hashToDocuments.get(hash);

    if (!existing || doc.modifiedAtMs > existing.modifiedAtMs) {
      hashToDocuments.set(hash, doc);
    }
  }

  return Array.from(hashToDocuments.values());
}
