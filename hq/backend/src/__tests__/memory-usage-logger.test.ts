import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { FileMemoryRetriever } from '../memory/file-memory-retriever';

function writeFile(root: string, rel: string, content: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

test('FileMemoryRetriever writes usage logs when enabled', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-memory-usage-'));
  writeFile(tmp, '.ai/context/project.md', '# Project\nWe use postgres and redis.\n');
  writeFile(tmp, '.ai/decisions/2026-03-26-decision.md', '# Decision\nUse hashing embedder.\n');

  const logPath = path.join(tmp, '.ai/usage/retrieval.jsonl');
  const retriever = new FileMemoryRetriever({
    memoryRootDir: path.join(tmp, '.ai'),
    enableCache: false,
    enableUsageLogs: true,
    usageLogPath: logPath,
  });

  await retriever.retrieveProjectContext('postgres', { limit: 2 });

  const raw = fs.readFileSync(logPath, 'utf-8').trim();
  assert.ok(raw.length > 0);
  const event = JSON.parse(raw.split('\n')[0]) as { query?: string; selectedCount?: number };
  assert.equal(event.query, 'postgres');
  assert.equal(typeof event.selectedCount, 'number');
});

