import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { loadHostManifest, listHostAdapters, getHostAdapter, renderHostInjectionSnippet } from '../host-adapters';

const manifestPath = path.resolve(__dirname, '../../../config/host-manifest.json');

test('loadHostManifest exposes project runtime defaults', async () => {
  const manifest = await loadHostManifest(manifestPath);
  assert.equal(manifest.project.name, 'The Agency HQ');
  assert.equal(manifest.project.stateDir, '~/.agency');
  assert.equal(manifest.hosts.length >= 3, true);
});

test('listHostAdapters returns explicit host capabilities and degradation strategy', async () => {
  const adapters = await listHostAdapters(manifestPath);
  const codex = adapters.find((adapter) => adapter.id === 'codex');
  assert.ok(codex);
  assert.equal(Array.isArray(codex?.supportedExecutors), true);
  assert.equal(codex?.supportedExecutors.includes('codex'), true);
  assert.equal(typeof codex?.degradation.manualFallback, 'string');
});

test('getHostAdapter returns host-specific injection targets', async () => {
  const claude = await getHostAdapter('claude', manifestPath);
  assert.ok(claude);
  assert.equal(claude?.injection.targetFile.includes('CLAUDE'), true);
  assert.equal(claude?.capabilityLevel, 'full');
});

test('renderHostInjectionSnippet includes host guidance and fallback instructions', async () => {
  const codex = await getHostAdapter('codex', manifestPath);
  assert.ok(codex);
  const snippet = renderHostInjectionSnippet(codex!);
  assert.equal(snippet.includes('The Agency HQ'), true);
  assert.equal(snippet.includes('fallback'), true);
  assert.equal(snippet.includes('Codex'), true);
});
