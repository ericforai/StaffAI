import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Scanner } from '../scanner';
import { Store } from '../store';
import { SkillScanner } from '../skill-scanner';
import { WebServer } from '../server';
import { createRuntimePaths, ensureRuntimeState } from '../runtime/runtime-state';

type EnvKey =
  | 'AGENCY_HOME'
  | 'AGENCY_DISCUSSION_CLAUDE_PATH'
  | 'AGENCY_DISCUSSION_CODEX_PATH'
  | 'OPENAI_API_KEY';

const originalEnv: Record<EnvKey, string | undefined> = {
  AGENCY_HOME: process.env.AGENCY_HOME,
  AGENCY_DISCUSSION_CLAUDE_PATH: process.env.AGENCY_DISCUSSION_CLAUDE_PATH,
  AGENCY_DISCUSSION_CODEX_PATH: process.env.AGENCY_DISCUSSION_CODEX_PATH,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

let webServer: WebServer;
let baseUrl = '';
let runtimeRootDir = '';

before(async () => {
  runtimeRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-runtime-routes-'));
  process.env.AGENCY_HOME = runtimeRootDir;
  process.env.AGENCY_DISCUSSION_CLAUDE_PATH = '/tmp/agency-missing-claude';
  process.env.AGENCY_DISCUSSION_CODEX_PATH = '/tmp/agency-missing-codex';
  delete process.env.OPENAI_API_KEY;

  const runtimePaths = createRuntimePaths(runtimeRootDir);
  await ensureRuntimeState(runtimePaths);

  const scanner = new Scanner();
  await scanner.scan();
  const store = new Store();
  const skillScanner = new SkillScanner();
  await skillScanner.scan();

  webServer = new WebServer(scanner, store, skillScanner);
  const port = await webServer.listen(0);
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (webServer) {
    await webServer.stop();
  }

  fs.rmSync(runtimeRootDir, { recursive: true, force: true });

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key as EnvKey];
      continue;
    }
    process.env[key as EnvKey] = value;
  }
});

test('GET /api/runtime/hosts returns host list and runtime state directory', async () => {
  const response = await fetch(`${baseUrl}/api/runtime/hosts`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    runtime?: { stateDir?: string };
    hosts?: Array<{ id: string }>;
  };

  assert.equal(payload.runtime?.stateDir, runtimeRootDir);
  assert.equal(Array.isArray(payload.hosts), true);
  assert.equal(payload.hosts?.some((host) => host.id === 'codex'), true);
});

test('GET /api/runtime/discovery returns capabilities and writes runtime snapshot', async () => {
  const response = await fetch(`${baseUrl}/api/runtime/discovery`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    runtime?: { agents?: number; skills?: number; hosts?: unknown[]; stateDir?: string };
    capabilities?: unknown[];
    boundAgents?: unknown[];
  };

  assert.equal(typeof payload.runtime?.agents, 'number');
  assert.equal(typeof payload.runtime?.skills, 'number');
  assert.equal(Array.isArray(payload.runtime?.hosts), true);
  assert.equal(Array.isArray(payload.capabilities), true);
  assert.equal(Array.isArray(payload.boundAgents), true);

  const snapshotPath = path.join(runtimeRootDir, 'cache', 'discovery', 'runtime-discovery.json');
  assert.equal(fs.existsSync(snapshotPath), true);
});

test('POST /api/runtime/recommend returns degraded recommendation for partial hosts', async () => {
  const response = await fetch(`${baseUrl}/api/runtime/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'debug why runtime host is degraded',
      hostId: 'gemini',
      activeAgentIds: [],
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    host?: { id?: string; capabilityLevel?: string };
    stage?: string;
    degraded?: boolean;
    recommendations?: Array<{ action: string }>;
  };

  assert.equal(payload.host?.id, 'gemini');
  assert.equal(payload.host?.capabilityLevel, 'partial');
  assert.equal(payload.stage, 'debug');
  assert.equal(payload.degraded, true);
  assert.equal(
    payload.recommendations?.some((item) => item.action === 'fallback_to_web_ui'),
    true
  );
});
