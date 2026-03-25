import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  indexMemoryDocuments,
  categorizeDocument,
  filterDocumentsByType,
  filterDocumentsByDateRange,
  deduplicateDocuments,
  type MemoryDocument,
  type DocumentCategory,
} from '../memory/memory-indexer';

test('indexMemoryDocuments scans directory and returns all markdown files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'decisions'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'routing.md'),
    '# Routing\nUse software architect for orchestration.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'api-design.md'),
    '# API Design\nREST vs GraphQL decision.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'readme.md'),
    '# Readme\nProject overview.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 3);
  const relativePaths = documents.map((doc) => doc.relativePath);
  assert.ok(relativePaths.includes(path.join('notes', 'routing.md')));
  assert.ok(relativePaths.includes(path.join('decisions', 'api-design.md')));
  assert.ok(relativePaths.includes('readme.md'));
  assert.ok(documents.every((doc) => doc.content.length > 0));
  assert.ok(documents.every((doc) => doc.modifiedAtMs > 0));

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments handles non-existent directory gracefully', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-empty-'));
  const memoryRootDir = path.join(root, '.ai', 'nonexistent');

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments handles empty directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-empty-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments ignores non-markdown files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-filter-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  fs.writeFileSync(path.join(memoryRootDir, 'notes.txt'), 'Plain text notes.', 'utf8');
  fs.writeFileSync(path.join(memoryRootDir, 'data.json'), '{"key": "value"}', 'utf8');
  fs.writeFileSync(path.join(memoryRootDir, 'valid.md'), '# Valid markdown\nContent.\n', 'utf8');

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.relativePath, 'valid.md');

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments handles nested directories deeply', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-nested-'));
  const memoryRootDir = path.join(root, '.ai');
  const deepPath = path.join(memoryRootDir, 'level1', 'level2', 'level3');
  fs.mkdirSync(deepPath, { recursive: true });

  fs.writeFileSync(
    path.join(deepPath, 'deep.md'),
    '# Deep File\nNested content.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 1);
  assert.equal(
    documents[0]?.relativePath,
    path.join('level1', 'level2', 'level3', 'deep.md')
  );

  fs.rmSync(root, { recursive: true, force: true });
});

test('categorizeDocument classifies documents by path patterns', () => {
  const testCases: Array<{
    relativePath: string;
    expectedCategory: DocumentCategory;
  }> = [
    { relativePath: 'notes/routing.md', expectedCategory: 'notes' },
    { relativePath: 'decisions/api-design.md', expectedCategory: 'decisions' },
    { relativePath: 'playbooks/incident.md', expectedCategory: 'playbooks' },
    { relativePath: 'agents/developer.md', expectedCategory: 'agents' },
    { relativePath: 'meetings/2026-03-25.md', expectedCategory: 'meetings' },
    { relativePath: 'task-summaries/task-123.md', expectedCategory: 'tasks' },
    { relativePath: 'readme.md', expectedCategory: 'other' },
    { relativePath: 'random/file.md', expectedCategory: 'other' },
  ];

  for (const { relativePath, expectedCategory } of testCases) {
    const category = categorizeDocument(relativePath);
    assert.equal(category, expectedCategory, `Failed for path: ${relativePath}`);
  }
});

test('filterDocumentsByType returns only documents of specified type', () => {
  const documents: MemoryDocument[] = [
    { path: '/a', relativePath: 'notes/routing.md', content: '', modifiedAtMs: 0 },
    { path: '/b', relativePath: 'decisions/api.md', content: '', modifiedAtMs: 0 },
    { path: '/c', relativePath: 'notes/other.md', content: '', modifiedAtMs: 0 },
    { path: '/d', relativePath: 'readme.md', content: '', modifiedAtMs: 0 },
  ];

  const notes = filterDocumentsByType(documents, 'notes');
  assert.equal(notes.length, 2);
  assert.ok(notes.every((doc) => doc.relativePath.startsWith('notes')));

  const decisions = filterDocumentsByType(documents, 'decisions');
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.relativePath, 'decisions/api.md');

  const other = filterDocumentsByType(documents, 'other');
  assert.equal(other.length, 1);
  assert.equal(other[0]?.relativePath, 'readme.md');
});

test('filterDocumentsByDateRange returns documents within date range', () => {
  const baseTime = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const documents: MemoryDocument[] = [
    {
      path: '/a',
      relativePath: 'old.md',
      content: '',
      modifiedAtMs: baseTime - 10 * dayMs,
    },
    {
      path: '/b',
      relativePath: 'recent1.md',
      content: '',
      modifiedAtMs: baseTime - 2 * dayMs,
    },
    {
      path: '/c',
      relativePath: 'recent2.md',
      content: '',
      modifiedAtMs: baseTime - 1 * dayMs,
    },
    {
      path: '/d',
      relativePath: 'future.md',
      content: '',
      modifiedAtMs: baseTime + dayMs,
    },
  ];

  const recent = filterDocumentsByDateRange(
    documents,
    baseTime - 3 * dayMs,
    baseTime
  );

  assert.equal(recent.length, 2);
  assert.ok(recent.every((doc) => doc.relativePath.startsWith('recent')));
});

test('filterDocumentsByDateRange handles open-ended ranges', () => {
  const baseTime = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const documents: MemoryDocument[] = [
    { path: '/a', relativePath: 'a.md', content: '', modifiedAtMs: baseTime - 10 * dayMs },
    { path: '/b', relativePath: 'b.md', content: '', modifiedAtMs: baseTime - 2 * dayMs },
    { path: '/c', relativePath: 'c.md', content: '', modifiedAtMs: baseTime },
  ];

  const fromOnly = filterDocumentsByDateRange(documents, baseTime - 5 * dayMs, undefined);
  assert.equal(fromOnly.length, 2);

  const toOnly = filterDocumentsByDateRange(documents, undefined, baseTime - 5 * dayMs);
  assert.equal(toOnly.length, 1);
  assert.equal(toOnly[0]?.relativePath, 'a.md');

  const noBounds = filterDocumentsByDateRange(documents, undefined, undefined);
  assert.equal(noBounds.length, 3);
});

test('deduplicateDocuments removes exact duplicates by content hash', () => {
  const content = '# Duplicate\nThis content appears multiple times.\n';
  const documents: MemoryDocument[] = [
    {
      path: '/a',
      relativePath: 'notes/routing.md',
      content,
      modifiedAtMs: 1000,
    },
    {
      path: '/b',
      relativePath: 'backup/routing.md',
      content,
      modifiedAtMs: 2000,
    },
    {
      path: '/c',
      relativePath: 'decisions/api.md',
      content: '# Different\nUnique content.\n',
      modifiedAtMs: 1500,
    },
  ];

  const deduplicated = deduplicateDocuments(documents);

  assert.equal(deduplicated.length, 2);
  assert.ok(deduplicated.some((doc) => doc.relativePath === 'backup/routing.md'));
  assert.ok(deduplicated.some((doc) => doc.relativePath === 'decisions/api.md'));
  assert.ok(
    !deduplicated.some((doc) => doc.relativePath === 'notes/routing.md')
  );
});

test('deduplicateDocuments keeps most recently modified version of duplicates', () => {
  const content = '# Duplicate\nSame content.\n';
  const documents: MemoryDocument[] = [
    {
      path: '/a',
      relativePath: 'old.md',
      content,
      modifiedAtMs: 1000,
    },
    {
      path: '/b',
      relativePath: 'new.md',
      content,
      modifiedAtMs: 2000,
    },
    {
      path: '/c',
      relativePath: 'newer.md',
      content,
      modifiedAtMs: 1500,
    },
  ];

  const deduplicated = deduplicateDocuments(documents);

  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0]?.relativePath, 'new.md');
  assert.equal(deduplicated[0]?.modifiedAtMs, 2000);
});

test('deduplicateDocuments handles empty array', () => {
  const deduplicated = deduplicateDocuments([]);
  assert.equal(deduplicated.length, 0);
});

test('deduplicateDocuments handles array with no duplicates', () => {
  const documents: MemoryDocument[] = [
    {
      path: '/a',
      relativePath: 'a.md',
      content: '# A\nContent A.\n',
      modifiedAtMs: 1000,
    },
    {
      path: '/b',
      relativePath: 'b.md',
      content: '# B\nContent B.\n',
      modifiedAtMs: 2000,
    },
  ];

  const deduplicated = deduplicateDocuments(documents);

  assert.equal(deduplicated.length, 2);
});

test('indexMemoryDocuments returns documents sorted by modification time (newest first)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-sort-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const oldPath = path.join(memoryRootDir, 'old.md');
  const newPath = path.join(memoryRootDir, 'new.md');

  fs.writeFileSync(oldPath, '# Old\nOld content.\n', 'utf8');
  fs.writeFileSync(newPath, '# New\nNew content.\n', 'utf8');

  const oldTime = new Date('2026-03-20T00:00:00.000Z');
  const newTime = new Date('2026-03-25T00:00:00.000Z');

  fs.utimesSync(oldPath, oldTime, oldTime);
  fs.utimesSync(newPath, newTime, newTime);

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 2);
  assert.equal(documents[0]?.relativePath, 'new.md');
  assert.equal(documents[1]?.relativePath, 'old.md');

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments handles files with special characters in names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-special-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const specialName = 'file with spaces & special-chars_2026.md';
  fs.writeFileSync(
    path.join(memoryRootDir, specialName),
    '# Special\nContent.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.relativePath, specialName);

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments handles files with UTF-8 content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-utf8-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const utf8Content = '# 中文测试\nThis is a test with 中文 and emoji 🎯.\n';
  fs.writeFileSync(path.join(memoryRootDir, 'utf8.md'), utf8Content, 'utf8');

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.content, utf8Content);
  assert.ok(documents[0]?.content.includes('中文'));
  assert.ok(documents[0]?.content.includes('🎯'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('indexMemoryDocuments handles very large files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-index-large-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const largeContent = '# Large File\n' + 'Line content.\n'.repeat(10000);
  fs.writeFileSync(path.join(memoryRootDir, 'large.md'), largeContent, 'utf8');

  const documents = indexMemoryDocuments(memoryRootDir);

  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.content.length, largeContent.length);

  fs.rmSync(root, { recursive: true, force: true });
});

test('filterDocumentsByType handles unknown category', () => {
  const documents: MemoryDocument[] = [
    { path: '/a', relativePath: 'notes/a.md', content: '', modifiedAtMs: 0 },
    { path: '/b', relativePath: 'decisions/b.md', content: '', modifiedAtMs: 0 },
  ];

  const unknown = filterDocumentsByType(documents, 'unknown' as DocumentCategory);
  assert.equal(unknown.length, 0);
});

test('filterDocumentsByType handles empty document array', () => {
  const filtered = filterDocumentsByType([], 'notes');
  assert.equal(filtered.length, 0);
});

test('filterDocumentsByDateRange handles empty document array', () => {
  const filtered = filterDocumentsByDateRange([], Date.now(), Date.now());
  assert.equal(filtered.length, 0);
});

test('filterDocumentsByDateRange handles inverted range (from > to)', () => {
  const baseTime = Date.now();
  const documents: MemoryDocument[] = [
    { path: '/a', relativePath: 'a.md', content: '', modifiedAtMs: baseTime - 1000 },
    { path: '/b', relativePath: 'b.md', content: '', modifiedAtMs: baseTime },
  ];

  const filtered = filterDocumentsByDateRange(
    documents,
    baseTime,
    baseTime - 2000
  );
  assert.equal(filtered.length, 0);
});
