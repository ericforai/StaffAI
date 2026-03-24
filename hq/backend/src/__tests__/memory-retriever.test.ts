import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { retrieveMemoryContext, writeExecutionSummaryToMemory } from '../memory/memory-retriever';

test('retrieveMemoryContext returns matching markdown entries from .ai memory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'notes'), { recursive: true });
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'routing.md'),
    '# Routing\nUse software architect for orchestration and routing decisions.\n',
    'utf8'
  );
  fs.writeFileSync(path.join(memoryRootDir, 'notes', 'other.md'), '# Misc\nUnrelated content.\n', 'utf8');

  const result = retrieveMemoryContext('Need routing and orchestration guidance', {
    memoryRootDir,
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.relativePath, path.join('notes', 'routing.md'));
  assert.match(result.context, /routing/i);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext tolerates missing memory directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-empty-'));
  const result = retrieveMemoryContext('any query', {
    memoryRootDir: path.join(root, '.ai'),
  });

  assert.deepEqual(result.entries, []);
  assert.equal(result.context, '');

  fs.rmSync(root, { recursive: true, force: true });
});

test('writeExecutionSummaryToMemory appends execution summary to task memory log', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-write-'));
  const memoryRootDir = path.join(root, '.ai');
  const now = new Date('2026-03-24T12:00:00.000Z');

  const filePath = writeExecutionSummaryToMemory(
    {
      id: 'task-123',
      title: 'Prepare release checklist',
      description: 'Summarize deployment readiness status',
      executionMode: 'single',
    },
    {
      id: 'exec-1',
      status: 'completed',
      executor: 'codex',
      outputSummary: 'Checklist generated with three blockers.',
    },
    {
      memoryRootDir,
      now,
    }
  );

  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /Execution exec-1/);
  assert.match(content, /task-123/);
  assert.match(content, /Checklist generated with three blockers/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext applies path and phrase weighting for more stable ranking', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-rank-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(path.join(memoryRootDir, 'playbooks'), { recursive: true });
  fs.writeFileSync(
    path.join(memoryRootDir, 'playbooks', 'incident-runbook.md'),
    '# Incident Runbook\nEscalation path, triage checklist, rollback workflow.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes.md'),
    '# Notes\nincident appears, runbook appears, but no concrete phrase guidance.\n',
    'utf8'
  );

  const result = retrieveMemoryContext('incident runbook triage checklist', {
    memoryRootDir,
    limit: 2,
  });

  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0]?.relativePath, path.join('playbooks', 'incident-runbook.md'));
  assert.ok((result.entries[0]?.score || 0) > (result.entries[1]?.score || 0));

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext falls back to recent documents when there is no lexical match', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-fallback-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });
  const oldPath = path.join(memoryRootDir, 'old.md');
  const newPath = path.join(memoryRootDir, 'new.md');
  fs.writeFileSync(oldPath, '# Legacy\nOld notes.\n', 'utf8');
  fs.writeFileSync(newPath, '# Fresh\nMost recent notes.\n', 'utf8');
  fs.utimesSync(oldPath, new Date('2026-03-20T00:00:00.000Z'), new Date('2026-03-20T00:00:00.000Z'));
  fs.utimesSync(newPath, new Date('2026-03-24T00:00:00.000Z'), new Date('2026-03-24T00:00:00.000Z'));

  const result = retrieveMemoryContext('query-without-overlap', {
    memoryRootDir,
    limit: 1,
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.relativePath, 'new.md');
  assert.equal(result.entries[0]?.score, 0);
  assert.match(result.context, /fresh/i);

  fs.rmSync(root, { recursive: true, force: true });
});

test('retrieveMemoryContext enforces context truncation limits', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-truncate-'));
  const memoryRootDir = path.join(root, '.ai');
  fs.mkdirSync(memoryRootDir, { recursive: true });
  fs.writeFileSync(
    path.join(memoryRootDir, 'large.md'),
    '# Large\n' + 'deployment '.repeat(300),
    'utf8'
  );

  const result = retrieveMemoryContext('deployment', {
    memoryRootDir,
    limit: 1,
    excerptMaxChars: 120,
    contextMaxChars: 140,
  });

  assert.equal(result.entries.length, 1);
  assert.ok(result.entries[0]?.excerpt.length <= 120);
  assert.ok(result.context.length <= 140);

  fs.rmSync(root, { recursive: true, force: true });
});
