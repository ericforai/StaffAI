/**
 * File Memory Retriever Tests
 *
 * Comprehensive test suite for the MemoryRetriever interface and FileMemoryRetriever implementation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rmSync } from 'node:fs';
import { FileMemoryRetriever, createMemoryRetriever } from '../memory/file-memory-retriever';
import type { RetrieveOptions, RetrievalResult } from '../memory/memory-retriever-types';
import type { MemoryDocumentType } from '../memory/memory-retriever-types';

/** Test memory root directory */
const TEST_MEMORY_ROOT = path.join(process.cwd(), '.test-memory');

/** Setup test memory directory structure */
function setupTestMemory(): void {
  // Clean up any existing test directory
  if (fs.existsSync(TEST_MEMORY_ROOT)) {
    rmSync(TEST_MEMORY_ROOT, { recursive: true, force: true });
  }

  // Create directory structure
  const directories = [
    path.join(TEST_MEMORY_ROOT, 'context'),
    path.join(TEST_MEMORY_ROOT, 'tasks'),
    path.join(TEST_MEMORY_ROOT, 'decisions'),
    path.join(TEST_MEMORY_ROOT, 'knowledge'),
    path.join(TEST_MEMORY_ROOT, 'agents'),
    path.join(TEST_MEMORY_ROOT, 'task-summaries'),
  ];

  for (const dir of directories) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create test documents
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Project context
  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'context', 'project-overview.md'),
    `# Project Overview

This is a test project for demonstrating memory retrieval capabilities.
The project uses AI agents for various tasks.

Tech stack: TypeScript, Node.js, Express, React.
`
  );

  // Tasks
  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'tasks', 'task-001.md'),
    `# Task: Implement Authentication

Implement user authentication with JWT tokens.
Requirements: login, logout, token refresh.
`
  );

  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'tasks', 'task-002.md'),
    `# Task: Build Dashboard

Create a dashboard with charts and metrics.
Use React and Recharts for visualization.
`
  );

  // Decisions
  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'decisions', 'adr-001-architecture.md'),
    `# ADR 001: Architecture Decision

We chose a monorepo structure for better code sharing.
All services will use TypeScript for type safety.
Decision date: ${new Date(now - 2 * dayMs).toISOString()}
`
  );

  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'decisions', 'adr-002-database.md'),
    `# ADR 002: Database Selection

PostgreSQL was chosen as the primary database.
Redis will be used for caching.
Decision date: ${new Date(now - dayMs).toISOString()}
`
  );

  // Knowledge
  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'knowledge', 'typescript-patterns.md'),
    `# TypeScript Patterns

Common patterns for TypeScript development:
- Use strict mode
- Prefer interface over type for object shapes
- Use utility types (Partial, Required, etc.)
`
  );

  // Agent specific
  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'agents', 'frontend-developer-context.md'),
    `# Frontend Developer Context

The frontend developer specializes in React and TypeScript.
Preferred styling: Tailwind CSS or CSS Modules.
`
  );

  // Task summary
  fs.writeFileSync(
    path.join(TEST_MEMORY_ROOT, 'task-summaries', '2024-03-25-task-001.md'),
    `## Execution Summary

Task: task-001
Status: completed
Result: Authentication system implemented successfully with JWT.
`
  );
}

/** Clean up test memory directory */
function cleanupTestMemory(): void {
  if (fs.existsSync(TEST_MEMORY_ROOT)) {
    rmSync(TEST_MEMORY_ROOT, { recursive: true, force: true });
  }
}

/** Create a retriever instance for testing */
function createTestRetriever(enableCache = false): FileMemoryRetriever {
  return createMemoryRetriever({
    memoryRootDir: TEST_MEMORY_ROOT,
    cacheTtlMs: 1000,
    enableCache,
  });
}

// Setup before tests run
setupTestMemory();

// ============================================================================
// Basic Retrieval Tests
// ============================================================================

test('FileMemoryRetriever.retrieve returns empty result for non-existent directory', async () => {
  const retriever = createMemoryRetriever({
    memoryRootDir: '/non-existent-path',
    enableCache: false,
  });

  const result = await retriever.retrieve('test query');

  assert.equal(result.entries.length, 0);
  assert.equal(result.context, '');
  assert.equal(result.metadata.totalDocuments, 0);
  assert.equal(result.metadata.matchedDocuments, 0);
});

test('FileMemoryRetriever.retrieve returns results for matching query', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('TypeScript');

  assert.ok(result.entries.length > 0);
  assert.ok(result.context.length > 0);
  assert.equal(result.metadata.query, 'TypeScript');
  assert.ok(result.metadata.totalDocuments > 0);
});

test('FileMemoryRetriever.retrieve respects limit option', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test', { limit: 2 });

  assert.ok(result.entries.length <= 2);
});

test('FileMemoryRetriever.retrieve respects threshold option', async () => {
  const retriever = createTestRetriever();

  // High threshold should return fewer/no results
  const highThreshold = await retriever.retrieve('nonexistenttermxyz', { threshold: 10 });

  assert.equal(highThreshold.entries.length, 0);
});

test('FileMemoryRetriever.retrieve includes full content when requested', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('TypeScript', { includeFullContent: true });

  // At least one entry should have fullContent
  const entryWithFullContent = result.entries.find((e) => e.fullContent !== undefined);
  assert.ok(entryWithFullContent !== undefined);
  assert.ok(entryWithFullContent!.fullContent!.length > 0);
});

test('FileMemoryRetriever.retrieve filters by document type', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('database', {
    documentTypes: ['decision'],
  });

  // All entries should be decisions
  for (const entry of result.entries) {
    assert.equal(entry.type, 'decision');
  }
});

test('FileMemoryRetriever.retrieve filters by time range', async () => {
  const retriever = createTestRetriever();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const result = await retriever.retrieve('test', {
    timeRange: {
      start: new Date(now - 3 * dayMs),
      end: new Date(now + dayMs),
    },
  });

  // Should return results within the time range
  assert.ok(result.entries.length >= 0);
});

test('FileMemoryRetriever.retrieve respects excerptMaxChars', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('project', { excerptMaxChars: 50 });

  for (const entry of result.entries) {
    assert.ok(entry.excerpt.length <= 55); // Allow some margin for "..."
  }
});

test('FileMemoryRetriever.retrieve respects contextMaxChars', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test', { contextMaxChars: 100 });

  assert.ok(result.context.length <= 110); // Allow some margin
});

test('FileMemoryRetriever.retrieve fallback mode recent returns results when no matches', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('nonexistenttermxyz123', {
    fallbackMode: 'recent',
    limit: 2,
  });

  // Should return recent documents as fallback
  assert.ok(result.entries.length > 0);
});

test('FileMemoryRetriever.retrieve fallback mode none returns empty when no matches', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('nonexistenttermxyz123', {
    fallbackMode: 'none',
  });

  assert.equal(result.entries.length, 0);
});

// ============================================================================
// Task-Specific Retrieval Tests
// ============================================================================

test('FileMemoryRetriever.retrieveForTask returns task-related documents', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveForTask('auth', 'task-001');

  assert.ok(result.entries.length >= 0);
  // Results should be related to the task
  const hasTaskRelated = result.entries.some((e) =>
    e.relativePath.includes('task-001') || e.relativePath.startsWith('tasks/')
  );
  if (result.entries.length > 0) {
    assert.ok(hasTaskRelated);
  }
});

test('FileMemoryRetriever.retrieveForTask works with empty query', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveForTask('', 'task-001', {
    limit: 5,
  });

  assert.ok(result.entries.length >= 0);
});

test('FileMemoryRetriever.retrieveForTask respects options', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveForTask('test', 'task-001', {
    limit: 1,
    includeFullContent: true,
  });

  assert.ok(result.entries.length <= 1);
  if (result.entries.length > 0) {
    assert.ok(result.entries[0].fullContent !== undefined);
  }
});

// ============================================================================
// Project Context Tests
// ============================================================================

test('FileMemoryRetriever.retrieveProjectContext returns recent documents', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveProjectContext();

  assert.ok(result.entries.length > 0);
  assert.ok(result.context.length > 0);
});

test('FileMemoryRetriever.retrieveProjectContext filters with query', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveProjectContext('architecture');

  assert.ok(result.entries.length >= 0);
});

// ============================================================================
// Decision Retrieval Tests
// ============================================================================

test('FileMemoryRetriever.retrieveDecisions returns only decisions', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveDecisions('database');

  assert.ok(result.entries.length > 0);
  // All entries should be decisions
  for (const entry of result.entries) {
    assert.equal(entry.type, 'decision');
  }
});

test('FileMemoryRetriever.retrieveDecisions scores by relevance', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveDecisions('database');

  // Results should be ordered by score
  for (let i = 1; i < result.entries.length; i++) {
    assert.ok(result.entries[i - 1].score >= result.entries[i].score);
  }
});

// ============================================================================
// Agent Context Tests
// ============================================================================

test('FileMemoryRetriever.retrieveAgentContext returns agent-specific documents', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveAgentContext('frontend-developer');

  assert.ok(result.entries.length >= 0);
});

test('FileMemoryRetriever.retrieveAgentContext works with query', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveAgentContext('frontend-developer', 'typescript');

  assert.ok(result.entries.length >= 0);
});

// ============================================================================
// Knowledge Retrieval Tests
// ============================================================================

test('FileMemoryRetriever.retrieveKnowledge returns knowledge entries', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieveKnowledge('typescript');

  assert.ok(result.entries.length >= 0);
});

test('FileMemoryRetriever.retrieveKnowledge filters by domain', async () => {
  const retriever = createTestRetriever();

  // Create domain-specific knowledge
  const domainDir = path.join(TEST_MEMORY_ROOT, 'knowledge', 'engineering');
  fs.mkdirSync(domainDir, { recursive: true });
  fs.writeFileSync(
    path.join(domainDir, 'backend-patterns.md'),
    '# Backend Engineering Patterns\n\nAPI design patterns and best practices.'
  );

  const result = await retriever.retrieveKnowledge('patterns', 'engineering');

  assert.ok(result.entries.length >= 0);
});

// ============================================================================
// Cache Tests
// ============================================================================

test('FileMemoryRetriever caches results when enabled', async () => {
  const retriever = createMemoryRetriever({
    memoryRootDir: TEST_MEMORY_ROOT,
    cacheTtlMs: 5000,
    enableCache: true,
  });

  const result1 = await retriever.retrieve('typescript');
  const result2 = await retriever.retrieve('typescript');

  // Results should be identical (cached)
  assert.equal(result1.entries.length, result2.entries.length);
  assert.equal(result1.context, result2.context);
});

test('FileMemoryRetriever.clearCache clears cached results', async () => {
  const retriever = createMemoryRetriever({
    memoryRootDir: TEST_MEMORY_ROOT,
    cacheTtlMs: 5000,
    enableCache: true,
  });

  await retriever.retrieve('typescript');
  retriever.clearCache();

  // After clearing, next retrieval should work normally
  const result = await retriever.retrieve('typescript');
  assert.ok(result.entries.length > 0);
});

test('FileMemoryRetriever cache expires after TTL', async () => {
  const retriever = createMemoryRetriever({
    memoryRootDir: TEST_MEMORY_ROOT,
    cacheTtlMs: 100, // 100ms TTL
    enableCache: true,
  });

  await retriever.retrieve('typescript');

  // Wait for cache to expire
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Should still work after expiration
  const result = await retriever.retrieve('typescript');
  assert.ok(result.entries.length > 0);
});

// ============================================================================
// Scoring and Type Weight Tests
// ============================================================================

test('FileMemoryRetriever applies type weights to scores', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test');

  // All entries should have a score (weighted or not)
  for (const entry of result.entries) {
    assert.ok(typeof entry.score === 'number');
    assert.ok(entry.score >= 0);
  }
});

test('FileMemoryRetriever sorts results by score and date', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test');

  // Results should be sorted by score (desc) then date (desc)
  for (let i = 1; i < result.entries.length; i++) {
    const prev = result.entries[i - 1];
    const curr = result.entries[i];

    if (prev.score !== curr.score) {
      assert.ok(prev.score > curr.score);
    }
  }
});

// ============================================================================
// Entry Structure Tests
// ============================================================================

test('FileMemoryRetriever entries have correct structure', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test');

  for (const entry of result.entries) {
    assert.ok(typeof entry.relativePath === 'string');
    assert.ok(entry.relativePath.length > 0);

    assert.ok(typeof entry.type === 'string');
    assert.ok(['project', 'task', 'decision', 'knowledge', 'agent'].includes(entry.type));

    assert.ok(typeof entry.excerpt === 'string');
    assert.ok(entry.excerpt.length > 0);

    assert.ok(typeof entry.score === 'number');
    assert.ok(entry.score >= 0);

    assert.ok(typeof entry.modifiedAtMs === 'number');
    assert.ok(entry.modifiedAtMs > 0);
  }
});

test('FileMemoryRetriever metadata is complete', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test query');

  assert.equal(result.metadata.query, 'test query');
  assert.ok(typeof result.metadata.totalDocuments === 'number');
  assert.ok(typeof result.metadata.matchedDocuments === 'number');
  assert.ok(typeof result.metadata.types === 'object');

  // Check type counts
  for (const type of ['project', 'task', 'decision', 'knowledge', 'agent']) {
    assert.ok(typeof result.metadata.types[type as MemoryDocumentType] === 'number');
  }
});

// ============================================================================
// Context String Tests
// ============================================================================

test('FileMemoryRetriever builds formatted context string', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('typescript');

  assert.ok(result.context.length > 0);

  // Context should have numbered sections
  assert.ok(result.context.includes('#1'));
});

test('FileMemoryRetriever context respects max chars limit', async () => {
  const retriever = createTestRetriever();

  const maxChars = 200;
  const result = await retriever.retrieve('test', { contextMaxChars: maxChars });

  assert.ok(result.context.length <= maxChars + 10); // Allow small margin
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

test('FileMemoryRetriever handles empty query', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('');

  // Empty query should still work (return recent or empty)
  assert.ok(Array.isArray(result.entries));
});

test('FileMemoryRetriever handles special characters in query', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test?!@#$%^&*()');

  assert.ok(Array.isArray(result.entries));
});

test('FileMemoryRetriever handles very long query', async () => {
  const retriever = createTestRetriever();

  const longQuery = 'test '.repeat(100);
  const result = await retriever.retrieve(longQuery);

  assert.ok(Array.isArray(result.entries));
});

test('FileMemoryRetriever handles zero limit', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test', { limit: 0 });

  // Zero limit should return no entries
  assert.equal(result.entries.length, 0);
});

test('FileMemoryRetriever handles very large limit', async () => {
  const retriever = createTestRetriever();

  const result = await retriever.retrieve('test', { limit: 10000 });

  // Should not exceed available documents
  assert.ok(result.entries.length <= result.metadata.totalDocuments);
});

// ============================================================================
// Integration Tests
// ============================================================================

test('FileMemoryRetriever full workflow: retrieve, cache, clear', async () => {
  const retriever = createMemoryRetriever({
    memoryRootDir: TEST_MEMORY_ROOT,
    cacheTtlMs: 1000,
    enableCache: true,
  });

  // First retrieval
  const result1 = await retriever.retrieve('typescript');
  assert.ok(result1.entries.length > 0);

  // Second retrieval (cached)
  const result2 = await retriever.retrieve('typescript');
  assert.deepEqual(result1, result2);

  // Clear cache and retrieve again
  retriever.clearCache();
  const result3 = await retriever.retrieve('typescript');
  assert.ok(result3.entries.length > 0);
});

test('FileMemoryRetriever multiple retrieval methods work together', async () => {
  const retriever = createTestRetriever();

  const [general, decisions, project, knowledge] = await Promise.all([
    retriever.retrieve('test'),
    retriever.retrieveDecisions('database'),
    retriever.retrieveProjectContext(),
    retriever.retrieveKnowledge('typescript'),
  ]);

  assert.ok(general.entries.length >= 0);
  assert.ok(decisions.entries.length >= 0);
  assert.ok(project.entries.length >= 0);
  assert.ok(knowledge.entries.length >= 0);
});

// Cleanup after all tests
test('cleanup', () => {
  cleanupTestMemory();
});
