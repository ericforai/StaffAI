import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  indexMemoryDocuments,
  deduplicateDocuments,
  filterDocumentsByType,
  type MemoryDocument,
} from '../memory/memory-indexer';
import {
  retrieveMemoryContext,
  retrieveForTask,
  retrieveProjectContext,
  retrieveDecisions,
  writeExecutionSummaryToMemory,
  clearMemoryCache,
} from '../memory/memory-retriever';
import {
  initializeAiDirectory,
  verifyDirectoryStructure,
} from '../memory/directory-initializer';
import {
  getCurrentUser,
  filterAgentsByUser,
  checkAccess,
} from '../memory/user-context-service';

test('Memory Layer Integration: end-to-end workflow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-integration-'));
  const memoryRootDir = path.join(root, '.ai');

  const initResult = initializeAiDirectory({
    rootDir: root,
    force: false,
    templates: true,
  });

  assert.equal(initResult.success, true);

  const verifyResult = verifyDirectoryStructure(memoryRootDir);
  assert.equal(verifyResult.valid, true);

  const notesDir = path.join(memoryRootDir, 'notes');
  fs.writeFileSync(
    path.join(notesDir, 'architecture.md'),
    '# Architecture\nMicroservices design pattern.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);
  assert.ok(documents.length > 0);

  const context = retrieveMemoryContext('architecture microservices', {
    memoryRootDir,
  });

  assert.ok(context.entries.length > 0);
  assert.ok(context.context.includes('Microservices'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: task execution summary workflow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-task-workflow-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  writeExecutionSummaryToMemory(
    {
      id: 'task-123',
      title: 'Implement API Gateway',
      description: 'Build rate limiting and authentication',
      executionMode: 'single',
    },
    {
      id: 'exec-1',
      status: 'completed',
      executor: 'codex',
      outputSummary: 'Rate limiting implemented with 100 req/s limit. Authentication using JWT.',
      errorMessage: '',
    },
    { memoryRootDir, now: new Date('2026-03-25T12:00:00.000Z') }
  );

  const taskContext = retrieveForTask('task-123', 'rate limiting JWT', {
    memoryRootDir,
  });

  assert.ok(taskContext.entries.some((e) => e.relativePath.includes('task-123')));
  assert.ok(taskContext.context.toLowerCase().includes('rate'));
  assert.ok(taskContext.context.includes('100'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: project context aggregation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-project-ctx-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'tech-stack.md'),
    '# Tech Stack\nNode.js, TypeScript, PostgreSQL.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'database.md'),
    '# Database\nPostgreSQL chosen for ACID compliance.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'playbooks', 'deployment.md'),
    '# Deployment\nDocker containers with Kubernetes.\n',
    'utf8'
  );

  const projectContext = retrieveProjectContext({
    memoryRootDir,
    limit: 10,
  });

  assert.ok(projectContext.entries.length >= 3);

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: decision filtering and retrieval', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-decisions-integration-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'api-design.md'),
    '# API Design\nREST vs GraphQL decision.\nChose REST for simplicity.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'auth-strategy.md'),
    '# Auth Strategy\nJWT vs Sessions decision.\nChose JWT for scalability.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'random.md'),
    '# Random\nNot a decision.\n',
    'utf8'
  );

  const allDocs = indexMemoryDocuments(memoryRootDir);
  const decisionsOnly = filterDocumentsByType(allDocs, 'decisions');

  assert.ok(decisionsOnly.length >= 2);

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: deduplication workflow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-dedup-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const content = '# Duplicate\nThis content appears in multiple files.\n';

  fs.writeFileSync(path.join(memoryRootDir, 'notes', 'original.md'), content, 'utf8');
  fs.writeFileSync(path.join(memoryRootDir, 'backup', 'copy.md'), content, 'utf8');
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'unique.md'),
    '# Unique\nDifferent content.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);
  const deduplicated = deduplicateDocuments(documents);

  assert.equal(deduplicated.length, 2);
  assert.ok(deduplicated.some((doc) => doc.relativePath === 'notes/original.md'));
  assert.ok(deduplicated.some((doc) => doc.relativePath === 'notes/unique.md'));
  assert.ok(!deduplicated.some((doc) => doc.relativePath === 'backup/copy.md'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: user context and access control', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-user-access-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const userConfig = {
    id: 'testuser',
    name: 'Test User',
    accessLevel: 'limited',
  };

  fs.writeFileSync(
    path.join(memoryRootDir, 'user.json'),
    JSON.stringify(userConfig),
    'utf8'
  );

  const originalHome = process.env.HOME;
  process.env.HOME = root;

  const user = getCurrentUser();
  assert.equal(user.id, 'testuser');
  assert.equal(user.accessLevel, 'limited');

  const agents = [
    { id: 'public-agent', name: 'Public Agent', access: 'public' },
    { id: 'internal-agent', name: 'Internal Agent', access: 'internal' },
  ];

  const filtered = filterAgentsByUser(agents, user);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'public-agent');

  process.env.HOME = originalHome;
  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: cache invalidation after write', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-cache-inval-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const filePath = path.join(memoryRootDir, 'notes', 'test.md');
  fs.writeFileSync(filePath, '# Test\nInitial content.\n', 'utf8');

  const query = 'test content';

  const result1 = retrieveMemoryContext(query, { memoryRootDir, useCache: true });
  assert.ok(result1.context.includes('Initial'));

  fs.writeFileSync(filePath, '# Test\nUpdated content.\n', 'utf8');

  const result2 = retrieveMemoryContext(query, { memoryRootDir, useCache: true });
  assert.ok(result2.context.includes('Initial'));

  clearMemoryCache();

  const result3 = retrieveMemoryContext(query, { memoryRootDir, useCache: true });
  assert.ok(result3.context.includes('Updated'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: multi-language content handling', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-multilang-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'chinese.md'),
    '# 中文文档\n这是一个中文文档。\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'japanese.md'),
    '# 日本語\nこれは日本語のドキュメントです。\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'english.md'),
    '# English\nThis is an English document.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);
  assert.equal(documents.length, 3);

  const mixedQuery = retrieveMemoryContext('中文 日本語 English', {
    memoryRootDir,
    limit: 3,
  });

  assert.ok(mixedQuery.entries.length >= 1);

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: large scale document handling', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-scale-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const docCount = 100;
  for (let i = 0; i < docCount; i++) {
    const fileName = `doc-${i}.md`;
    const content = `# Document ${i}\nContent for document ${i}.\nKeywords: test, sample.\n`;
    fs.writeFileSync(path.join(memoryRootDir, 'notes', fileName), content, 'utf8');
  }

  const documents = indexMemoryDocuments(memoryRootDir);
  assert.equal(documents.length, docCount);

  const deduplicated = deduplicateDocuments(documents);
  assert.equal(deduplicated.length, docCount);

  const context = retrieveMemoryContext('test sample keywords', {
    memoryRootDir,
    limit: 10,
  });

  assert.equal(context.entries.length, 10);
  assert.ok(context.context.length > 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: incremental updates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-incremental-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'doc1.md'),
    '# Doc 1\nInitial content.\n',
    'utf8'
  );

  let documents = indexMemoryDocuments(memoryRootDir);
  assert.equal(documents.length, 1);

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'doc2.md'),
    '# Doc 2\nNew content.\n',
    'utf8'
  );

  documents = indexMemoryDocuments(memoryRootDir);
  assert.equal(documents.length, 2);

  const context = retrieveMemoryContext('doc1 doc2', { memoryRootDir });
  assert.equal(context.entries.length, 2);

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: concurrent access simulation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-concurrent-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  for (let i = 0; i < 10; i++) {
    fs.writeFileSync(
      path.join(memoryRootDir, 'notes', `concurrent-${i}.md`),
      `# Concurrent ${i}\nContent.\n`,
      'utf8'
    );
  }

  const documents = indexMemoryDocuments(memoryRootDir);
  assert.equal(documents.length, 10);

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: recovery from corrupted state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-recovery-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'valid.md'),
    '# Valid\nValid content.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'invalid.txt'),
    'Not a markdown file.\n',
    'utf8'
  );

  const documents = indexMemoryDocuments(memoryRootDir);
  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.relativePath, 'notes/valid.md');

  const context = retrieveMemoryContext('valid content', { memoryRootDir });
  assert.ok(context.context.includes('Valid'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('Memory Layer Integration: template-based task creation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-templates-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const templatePath = path.join(memoryRootDir, 'notes', '_template.md');
  assert.ok(fs.existsSync(templatePath));

  const templateContent = fs.readFileSync(templatePath, 'utf8');

  const newNotePath = path.join(memoryRootDir, 'notes', 'new-note.md');
  fs.writeFileSync(newNotePath, templateContent.replace('Template', 'New Note'), 'utf8');

  const documents = indexMemoryDocuments(memoryRootDir);
  assert.ok(documents.some((doc) => doc.relativePath === 'notes/new-note.md'));

  fs.rmSync(root, { recursive: true, force: true });
});
