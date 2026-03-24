import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRuntimePaths, ensureRuntimeState, writeRuntimeSnapshot, readRuntimeSnapshot } from '../runtime-state';

test('createRuntimePaths uses AGENCY_HOME when provided', () => {
  const runtime = createRuntimePaths('/tmp/agency-home');
  assert.equal(runtime.rootDir, '/tmp/agency-home');
  assert.equal(runtime.configDir, '/tmp/agency-home/config');
  assert.equal(runtime.hostCacheDir, '/tmp/agency-home/cache/hosts');
  assert.equal(runtime.discoveryCacheDir, '/tmp/agency-home/cache/discovery');
  assert.equal(runtime.generatedDir, '/tmp/agency-home/generated');
});

test('ensureRuntimeState creates the runtime directory structure', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-runtime-'));

  try {
    const runtime = createRuntimePaths(tempDir);
    await ensureRuntimeState(runtime);

    for (const expectedPath of [
      runtime.rootDir,
      runtime.configDir,
      runtime.hostCacheDir,
      runtime.discoveryCacheDir,
      runtime.sessionsDir,
      runtime.logsDir,
      runtime.generatedDir,
      runtime.executorsDir,
    ]) {
      assert.equal(fs.existsSync(expectedPath), true, `${expectedPath} should exist`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('runtime snapshots round-trip through discovery cache', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-runtime-'));

  try {
    const runtime = createRuntimePaths(tempDir);
    await ensureRuntimeState(runtime);

    const payload = {
      generatedAt: '2026-03-23T11:00:00.000Z',
      hosts: ['claude', 'codex'],
      recommendations: ['run setup', 'review host status'],
    };

    await writeRuntimeSnapshot(runtime, 'runtime-discovery.json', payload);
    const loaded = await readRuntimeSnapshot<typeof payload>(runtime, 'runtime-discovery.json');

    assert.deepEqual(loaded, payload);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
