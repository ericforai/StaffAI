/**
 * Knowledge Adapter Tests
 *
 * TDD tests for the knowledge adapter, ensuring compatibility
 * between JSON and Markdown knowledge storage.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KnowledgeAdapter,
  createKnowledgeAdapter,
  isValidEntry,
} from '../legacy/knowledge-adapter';
import {
  getMarkdownFilename,
  formatMarkdown,
  inferCategory,
  migrateKnowledgeToJson,
} from '../legacy/knowledge-migrator';
import type { JsonKnowledgeEntry } from '../legacy/knowledge-types';

function createTempEnvironment(): { tempDir: string; memoryRootDir: string; jsonKnowledgePath: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-test-'));
  const memoryRootDir = tempDir;
  const jsonKnowledgePath = path.join(tempDir, 'knowledge.json');
  return { tempDir, memoryRootDir, jsonKnowledgePath };
}

function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const sampleEntry: JsonKnowledgeEntry = {
  task: 'Implement login feature',
  agentId: 'engineering/frontend-developer',
  resultSummary: 'Created a React login component with form validation.',
  timestamp: 1_700_000_000_000,
};

test('KnowledgeAdapter.save - writes knowledge entry to JSON file', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);
    await adapter.save(sampleEntry);

    assert.equal(fs.existsSync(jsonKnowledgePath), true);

    const content = fs.readFileSync(jsonKnowledgePath, 'utf-8');
    const entries = JSON.parse(content) as JsonKnowledgeEntry[];

    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], sampleEntry);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.save - writes knowledge entry to Markdown directory', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);
    await adapter.save(sampleEntry);

    const knowledgeDir = path.join(memoryRootDir, 'knowledge');
    assert.equal(fs.existsSync(knowledgeDir), true);

    // Find the markdown file (category subdirectory)
    const files: string[] = [];
    const walkDir = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          walkDir(fullPath);
        } else if (item.isFile() && item.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };
    walkDir(knowledgeDir);

    assert.ok(files.length > 0, 'Should have at least one markdown file');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.save - limits JSON entries to MAX_KNOWLEDGE_ENTRIES', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);
    const max = 100;

    // Create 105 entries
    for (let i = 0; i < 105; i++) {
      await adapter.save({
        task: `Task ${i}`,
        agentId: 'agent-1',
        resultSummary: `Result ${i}`,
      });
    }

    const content = fs.readFileSync(jsonKnowledgePath, 'utf-8');
    const saved = JSON.parse(content) as JsonKnowledgeEntry[];

    assert.ok(saved.length <= max, `Should have ${max} or fewer entries, got ${saved.length}`);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.save - adds timestamp to entries without one', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);
    const entryWithoutTimestamp: JsonKnowledgeEntry = {
      task: 'Test task',
      agentId: 'agent-1',
      resultSummary: 'Test result',
    };

    await adapter.save(entryWithoutTimestamp);

    const content = fs.readFileSync(jsonKnowledgePath, 'utf-8');
    const entries = JSON.parse(content) as JsonKnowledgeEntry[];

    assert.ok(entries[0].timestamp !== undefined);
    assert.ok((entries[0].timestamp ?? 0) > 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.search - returns results matching the query', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    await adapter.save({
      task: 'Implement React component for user dashboard',
      agentId: 'engineering/frontend-developer',
      resultSummary: 'Created responsive dashboard with charts.',
    });

    await adapter.save({
      task: 'Setup PostgreSQL database connection',
      agentId: 'engineering/backend-developer',
      resultSummary: 'Configured connection pooling and migrations.',
    });

    await adapter.save({
      task: 'Design new logo for marketing',
      agentId: 'design/graphic-designer',
      resultSummary: 'Created vector logo in multiple formats.',
    });

    const results = adapter.search('React');

    assert.ok(results.length > 0);
    assert.ok(results[0].agentId.includes('frontend'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.search - returns empty array for empty query', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);
    const results = adapter.search('');

    assert.deepEqual(results, []);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.search - limits results to specified limit', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    await adapter.save({ task: 'Engineering task 1', agentId: 'engineering/agent', resultSummary: 'Done' });
    await adapter.save({ task: 'Engineering task 2', agentId: 'engineering/agent', resultSummary: 'Done' });

    const results = adapter.search('engineering', 1);

    assert.ok(results.length <= 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.search - ranks results by relevance score', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    await adapter.save({
      task: 'Backend API development',
      agentId: 'engineering/backend-developer',
      resultSummary: 'REST API created',
    });

    await adapter.save({
      task: 'Frontend UI design',
      agentId: 'engineering/frontend-developer',
      resultSummary: 'React components built',
    });

    const results = adapter.search('backend');

    // Most relevant should be first
    assert.ok(results[0].agentId.includes('backend'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.getAll - returns all entries from both sources', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    await adapter.save({
      task: 'Task 1',
      agentId: 'agent-1',
      resultSummary: 'Result 1',
    });

    await adapter.save({
      task: 'Task 2',
      agentId: 'agent-2',
      resultSummary: 'Result 2',
    });

    const all = adapter.getAll();

    assert.ok(all.length >= 2);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.getAll - marks source correctly', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    await adapter.save({
      task: 'Task 1',
      agentId: 'agent-1',
      resultSummary: 'Result 1',
    });

    const all = adapter.getAll();
    const jsonEntry = all.find((e) => e.source === 'json');

    assert.ok(jsonEntry !== undefined);
    assert.equal(jsonEntry?.source, 'json');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.migrateToJson - migrates JSON entries to Markdown', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    // Add some JSON entries
    fs.writeFileSync(
      jsonKnowledgePath,
      JSON.stringify([
        {
          task: 'Migrate me',
          agentId: 'test-agent',
          resultSummary: 'Please migrate',
          timestamp: 1_700_000_000_000,
        },
      ])
    );

    const result = await adapter.migrateToJson({
      memoryRootDir: tempDir,
      jsonKnowledgePath,
    });

    assert.equal(result.success, true);
    assert.equal(result.migratedCount, 1);

    // Check markdown file exists
    const knowledgeDir = path.join(memoryRootDir, 'knowledge');
    assert.equal(fs.existsSync(knowledgeDir), true);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.migrateToJson - supports dry-run mode', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    fs.writeFileSync(
      jsonKnowledgePath,
      JSON.stringify([
        {
          task: 'Dry run test',
          agentId: 'agent',
          resultSummary: 'Should not write',
        },
      ])
    );

    const result = await adapter.migrateToJson({
      memoryRootDir: tempDir,
      jsonKnowledgePath,
      dryRun: true,
    });

    assert.equal(result.migratedCount, 1);
    assert.equal(result.skippedCount, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.migrateToJson - skips existing files', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    const entry = {
      task: 'Existing entry',
      agentId: 'agent',
      resultSummary: 'Already exists',
      timestamp: 1_700_000_000_000,
    };

    fs.writeFileSync(jsonKnowledgePath, JSON.stringify([entry]));

    // First migration
    await adapter.migrateToJson({
      memoryRootDir: tempDir,
      jsonKnowledgePath,
    });

    // Second migration should skip
    const result = await adapter.migrateToJson({
      memoryRootDir: tempDir,
      jsonKnowledgePath,
    });

    assert.equal(result.skippedCount, 1);
    assert.equal(result.migratedCount, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.migrateToJson - filters by timestamp', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);

    const oldEntry = {
      task: 'Old task',
      agentId: 'agent',
      resultSummary: 'Old result',
      timestamp: 1_600_000_000_000,
    };

    const newEntry = {
      task: 'New task',
      agentId: 'agent',
      resultSummary: 'New result',
      timestamp: 1_700_000_000_000,
    };

    fs.writeFileSync(jsonKnowledgePath, JSON.stringify([oldEntry, newEntry]));

    const result = await adapter.migrateToJson({
      memoryRootDir: tempDir,
      jsonKnowledgePath,
      afterTimestamp: 1_650_000_000_000,
    });

    assert.equal(result.migratedCount, 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('KnowledgeAdapter.migrateToJson - calls progress callback', async () => {
  const { tempDir, memoryRootDir, jsonKnowledgePath } = createTempEnvironment();

  try {
    const adapter = createKnowledgeAdapter(memoryRootDir, jsonKnowledgePath);
    const progressCalls: number[] = [];

    fs.writeFileSync(
      jsonKnowledgePath,
      JSON.stringify([
        { task: 'T1', agentId: 'a1', resultSummary: 'R1' },
        { task: 'T2', agentId: 'a2', resultSummary: 'R2' },
      ])
    );

    await adapter.migrateToJson({
      memoryRootDir: tempDir,
      jsonKnowledgePath,
      onProgress: (current, total) => {
        progressCalls.push(current, total);
      },
    });

    assert.deepEqual(progressCalls, [1, 2, 2, 2]);
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Utility function tests

test('getMarkdownFilename - generates consistent filename', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Test task',
    agentId: 'test-agent',
    resultSummary: 'Test result',
    timestamp: 1_700_000_000_000,
  };

  const filename = getMarkdownFilename(entry);

  assert.ok(/^\d{4}-\d{2}-\d{2}-.*-.*\.md$/.test(filename));
});

test('getMarkdownFilename - sanitizes agent ID in filename', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Task',
    agentId: 'agent/with/slashes',
    resultSummary: 'Result',
    timestamp: 1_700_000_000_000,
  };

  const filename = getMarkdownFilename(entry);

  assert.ok(!filename.includes('/'));
  assert.ok(filename.includes('-'));
});

test('formatMarkdown - formats entry as valid Markdown', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Build API',
    agentId: 'backend-dev',
    resultSummary: 'REST API created',
  };

  const md = formatMarkdown(entry);

  assert.ok(md.includes('# Knowledge Entry'));
  assert.ok(md.includes('## Task'));
  assert.ok(md.includes('Build API'));
  assert.ok(md.includes('## Result Summary'));
  assert.ok(md.includes('REST API created'));
  assert.ok(md.includes('> Agent: backend-dev'));
});

test('inferCategory - infers frontend category', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Create React component',
    agentId: 'frontend-dev',
    resultSummary: 'Done',
  };

  assert.equal(inferCategory(entry), 'frontend');
});

test('inferCategory - infers backend category', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Build API endpoint',
    agentId: 'backend-dev',
    resultSummary: 'Done',
  };

  assert.equal(inferCategory(entry), 'backend');
});

test('inferCategory - infers design category', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Design logo',
    agentId: 'designer',
    resultSummary: 'Created',
  };

  assert.equal(inferCategory(entry), 'design');
});

test('inferCategory - defaults to general', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Some random task',
    agentId: 'generalist',
    resultSummary: 'Done',
  };

  assert.equal(inferCategory(entry), 'general');
});

test('isValidEntry - validates correct entry', () => {
  const entry: JsonKnowledgeEntry = {
    task: 'Task',
    agentId: 'agent',
    resultSummary: 'Summary',
  };

  assert.equal(isValidEntry(entry), true);
});

test('isValidEntry - rejects entry with missing fields', () => {
  assert.equal(isValidEntry({ task: '', agentId: 'a', resultSummary: 'r' }), false);
  assert.equal(isValidEntry({ task: 't', agentId: '', resultSummary: 'r' }), false);
  assert.equal(isValidEntry({ task: 't', agentId: 'a', resultSummary: '' }), false);
});

test('isValidEntry - rejects non-object input', () => {
  assert.equal(isValidEntry(null), false);
  assert.equal(isValidEntry(undefined), false);
  assert.equal(isValidEntry('string'), false);
});
