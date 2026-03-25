import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  retrieveMemoryContext,
  retrieveForTask,
  retrieveProjectContext,
  retrieveDecisions,
  retrieveAgentContext,
  retrieveKnowledge,
  writeExecutionSummaryToMemory,
  clearMemoryCache,
  type RetrievedMemoryContext,
} from '../memory/memory-retriever';

test('retrieveForTask extracts task-specific context from memory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-task-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'task-summaries'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'task-summaries', 'task-123.md'),
    '## Execution exec-1\n- Task: Build API gateway\n- Result: Implemented rate limiting.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'routing.md'),
    '# Routing\nUse API gateway for external requests.\n',
    'utf8'
  );

  const result = retrieveForTask('task-123', 'API gateway rate limiting', {
    memoryRootDir,
  });

  assert.ok(result.context.includes('API gateway'));
  assert.ok(result.entries.some((e) => e.relativePath.includes('task-123.md')));

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveForTask handles non-existent task gracefully', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-task-empty-'));
  const memoryRootDir = path.join(root, '.ai');

  const result = retrieveForTask('nonexistent-task', 'any query', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 0);
  assert.equal(result.context, '');

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveProjectContext aggregates project-wide memory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-project-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'playbooks'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'architecture.md'),
    '# Architecture\nMicroservices with event-driven communication.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'database.md'),
    '# Database\nPostgreSQL as primary database.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'playbooks', 'deployment.md'),
    '# Deployment\nBlue-green deployment strategy.\n',
    'utf8'
  );

  const result = retrieveProjectContext({
    memoryRootDir,
    limit: 5,
  });

  assert.equal(result.entries.length, 3);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveProjectContext returns empty result for empty memory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-project-empty-'));
  const memoryRootDir = path.join(root, '.ai');

  const result = retrieveProjectContext({
    memoryRootDir,
  });

  assert.equal(result.entries.length, 0);
  assert.equal(result.context, '');

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveDecisions filters and returns decision documents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-decisions-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'api-design.md'),
    '# API Design\nChose REST over GraphQL for simplicity.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'database.md'),
    '# Database\nPostgreSQL for relational data.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'random.md'),
    '# Random\nNot a decision.\n',
    'utf8'
  );

  const result = retrieveDecisions('database design', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 2);
  assert.ok(result.entries.every((e) => e.relativePath.startsWith('decisions')));
  assert.ok(result.context.includes('PostgreSQL'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveDecisions handles empty decisions directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-decisions-empty-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'decisions'), { recursive: true });

  const result = retrieveDecisions('any query', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 0);
  assert.equal(result.context, '');

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveAgentContext extracts agent-specific information', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-agent-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'agents'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'agents', 'frontend-developer.md'),
    '# Frontend Developer\nReact, TypeScript, and CSS expertise.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'agents', 'backend-developer.md'),
    '# Backend Developer\nNode.js, PostgreSQL, and API design.\n',
    'utf8'
  );

  const result = retrieveAgentContext('frontend-developer', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.relativePath, 'agents/frontend-developer.md');
  assert.ok(result.context.includes('React'));
  assert.ok(result.context.includes('TypeScript'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveAgentContext handles non-existent agent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-agent-missing-'));
  const memoryRootDir = path.join(root, '.ai');

  const result = retrieveAgentContext('nonexistent-agent', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 0);
  assert.equal(result.context, '');

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveKnowledge searches all memory categories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-knowledge-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'playbooks'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'decisions'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'authentication.md'),
    '# Authentication\nJWT-based auth system.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'playbooks', 'security.md'),
    '# Security\nIncident response playbook.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'decisions', 'auth-strategy.md'),
    '# Auth Strategy\nDecision to use JWT.\n',
    'utf8'
  );

  const result = retrieveKnowledge('JWT authentication security', {
    memoryRootDir,
    limit: 3,
  });

  assert.ok(result.entries.length >= 2);
  assert.ok(result.context.includes('JWT'));
  assert.equal(result.entries.length, 3);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveKnowledge handles empty query gracefully', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-knowledge-empty-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'test.md'),
    '# Test\nContent.\n',
    'utf8'
  );

  const result = retrieveKnowledge('', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 0);
  assert.equal(result.context, '');

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext uses cache for repeated queries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-cache-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'test.md'),
    '# Test\nCached content.\n',
    'utf8'
  );

  const query = 'test query';
  const options = { memoryRootDir, useCache: true };

  const result1 = retrieveMemoryContext(query, options);
  const result2 = retrieveMemoryContext(query, options);

  assert.deepEqual(result1, result2);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext bypasses cache when useCache is false', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-no-cache-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const filePath = path.join(memoryRootDir, 'test.md');
  fs.writeFileSync(filePath, '# Test\nInitial content.\n', 'utf8');

  const query = 'test query';

  const result1 = retrieveMemoryContext(query, { memoryRootDir, useCache: true });

  fs.writeFileSync(filePath, '# Test\nUpdated content.\n', 'utf8');

  const result2 = retrieveMemoryContext(query, { memoryRootDir, useCache: false });

  assert.ok(result2.context.includes('Updated'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('clearMemoryCache clears internal cache', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-clear-cache-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const filePath = path.join(memoryRootDir, 'test.md');
  fs.writeFileSync(filePath, '# Test\nInitial content.\n', 'utf8');

  const query = 'test query';

  const result1 = retrieveMemoryContext(query, { memoryRootDir, useCache: true });

  fs.writeFileSync(filePath, '# Test\nUpdated content.\n', 'utf8');

  clearMemoryCache();

  const result2 = retrieveMemoryContext(query, { memoryRootDir, useCache: true });

  assert.ok(result2.context.includes('Updated'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('writeExecutionSummaryToMemory creates directory if not exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-write-'));
  const memoryRootDir = path.join(root, '.ai');

  const filePath = writeExecutionSummaryToMemory(
    {
      id: 'task-123',
      title: 'Test Task',
      description: 'Test description',
      executionMode: 'single',
    },
    {
      id: 'exec-1',
      status: 'completed',
      executor: 'codex',
      outputSummary: 'Test completed successfully.',
      errorMessage: '',
    },
    { memoryRootDir }
  );

  assert.ok(fs.existsSync(filePath));
  assert.ok(filePath.includes('task-summaries'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('writeExecutionSummaryToMemory appends to existing file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-append-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'task-summaries'), { recursive: true });

  const fileName = '2026-03-25-task-123.md';
  const filePath = path.join(memoryRootDir, 'task-summaries', fileName);

  fs.writeFileSync(filePath, '# Existing Content\n', 'utf8');

  writeExecutionSummaryToMemory(
    {
      id: 'task-123',
      title: 'Test Task',
      description: 'Test description',
      executionMode: 'single',
    },
    {
      id: 'exec-1',
      status: 'completed',
      executor: 'codex',
      outputSummary: 'Test completed.',
      errorMessage: '',
    },
    { memoryRootDir, now: new Date('2026-03-25T12:00:00.000Z') }
  );

  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('# Existing Content'));
  assert.ok(content.includes('Execution exec-1'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('writeExecutionSummaryToMemory uses errorMessage when outputSummary is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-error-'));
  const memoryRootDir = path.join(root, '.ai');

  const filePath = writeExecutionSummaryToMemory(
    {
      id: 'task-123',
      title: 'Failed Task',
      description: 'Test description',
      executionMode: 'single',
    },
    {
      id: 'exec-1',
      status: 'failed',
      executor: 'codex',
      outputSummary: '',
      errorMessage: 'Execution failed: timeout',
    },
    { memoryRootDir }
  );

  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('Execution failed: timeout'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext handles special characters in query', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-special-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'test.md'),
    '# Test\nContent with special chars: @#$%^&*()\n',
    'utf8'
  );

  const result = retrieveMemoryContext('special chars @#$%', {
    memoryRootDir,
  });

  assert.ok(result.entries.length > 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext handles multilingual content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-i18n-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'chinese.md'),
    '# 中文测试\n这是中文内容。\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'japanese.md'),
    '# 日本語テスト\nこれは日本語のコンテンツです。\n',
    'utf8'
  );

  const result = retrieveMemoryContext('中文 日本語', {
    memoryRootDir,
  });

  assert.ok(result.entries.length >= 1);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext respects limit parameter', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-limit-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(
      path.join(memoryRootDir, `file${i}.md`),
      `# File ${i}\nContent about testing.\n`,
      'utf8'
    );
  }

  const result = retrieveMemoryContext('testing', {
    memoryRootDir,
    limit: 2,
  });

  assert.equal(result.entries.length, 2);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext handles very long context strings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-long-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });

  const longContent = '# Long Content\n' + 'word '.repeat(10000);
  fs.writeFileSync(path.join(memoryRootDir, 'long.md'), longContent, 'utf8');

  const result = retrieveMemoryContext('long content', {
    memoryRootDir,
    contextMaxChars: 500,
  });

  assert.ok(result.context.length <= 500);
  assert.ok(result.entries.length > 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveForTask prioritizes task-specific documents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-task-priority-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'task-summaries'), { recursive: true });
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });

  fs.writeFileSync(
    path.join(memoryRootDir, 'task-summaries', '2026-03-25-task-123.md'),
    '## Execution exec-1\n- Task: API Gateway\n- Result: Implemented rate limiting.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'api.md'),
    '# API\nGeneral API documentation.\n',
    'utf8'
  );

  const result = retrieveForTask('task-123', 'rate limiting', {
    memoryRootDir,
  });

  assert.ok(
    result.entries.some((e) => e.relativePath.includes('task-123.md'))
  );

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveDecisions sorts by recency when no query match', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-decisions-recent-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'decisions'), { recursive: true });

  const oldPath = path.join(memoryRootDir, 'decisions', 'old.md');
  const newPath = path.join(memoryRootDir, 'decisions', 'new.md');

  fs.writeFileSync(oldPath, '# Old\nOld decision.\n', 'utf8');
  fs.writeFileSync(newPath, '# New\nNew decision.\n', 'utf8');

  fs.utimesSync(oldPath, new Date('2026-03-20'), new Date('2026-03-20'));
  fs.utimesSync(newPath, new Date('2026-03-25'), new Date('2026-03-25'));

  const result = retrieveDecisions('no-match-query', {
    memoryRootDir,
    limit: 1,
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.relativePath, 'decisions/new.md');

  fs.rmSync(root, { recursive: true, force: true });
});
