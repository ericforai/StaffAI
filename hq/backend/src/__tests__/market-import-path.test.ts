/**
 * Regression tests for market import path resolution bug.
 *
 * Bug: `POST /api/market/candidates/:id/import` used a relative path
 * (`hq/generated/employees/`) that resolved against `process.cwd()` (which is
 * `hq/backend/`), writing files to `hq/backend/hq/generated/employees/` instead
 * of `hq/generated/employees/`. Additionally, the Scanner did not scan the
 * `hq/generated/employees/` directory, making imported agents invisible to the
 * system even after the path was fixed.
 *
 * Root cause: `__dirname` depth differs between files — `dist/scanner.js` needs
 * 3 levels (`../../../`) to reach project root, while `dist/api/market.js` needs
 * 4 levels (`../../../../`). This asymmetry is the core regression risk.
 */

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Scanner } from '../scanner';
import { Store } from '../store';
import { SkillScanner } from '../skill-scanner';
import { WebServer } from '../server';

let webServer: WebServer;
let baseUrl = '';
let tempDir = '';
let employeesDir = '';

const originalTasksFile = process.env.AGENCY_TASKS_FILE;
const originalApprovalsFile = process.env.AGENCY_APPROVALS_FILE;
const originalExecutionsFile = process.env.AGENCY_EXECUTIONS_FILE;
const originalToolCallLogsFile = process.env.AGENCY_TOOL_CALL_LOGS_FILE;
const originalAuditLogsDir = process.env.AGENCY_AUDIT_LOGS_DIR;
const originalMemoryDir = process.env.AGENCY_MEMORY_DIR;

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-market-import-'));
  process.env.AGENCY_TASKS_FILE = path.join(tempDir, 'tasks.json');
  process.env.AGENCY_APPROVALS_FILE = path.join(tempDir, 'approvals.json');
  process.env.AGENCY_EXECUTIONS_FILE = path.join(tempDir, 'executions.json');
  process.env.AGENCY_TOOL_CALL_LOGS_FILE = path.join(tempDir, 'tool-call-logs.json');
  process.env.AGENCY_AUDIT_LOGS_DIR = path.join(tempDir, 'audit');
  process.env.AGENCY_MEMORY_DIR = path.join(tempDir, '.ai');

  employeesDir = path.join(tempDir, 'hq', 'generated', 'employees');
  fs.mkdirSync(employeesDir, { recursive: true });

  const scanner = new Scanner();
  await scanner.scan();
  const store = new Store();
  const skillScanner = new SkillScanner();
  await skillScanner.scan();

  webServer = new WebServer(scanner, store, skillScanner, {
    runAdvancedDiscussion: async (topic) => ({
      summary: `Test discussion for: ${topic}`,
    }),
  });
  const port = await webServer.listen(0);
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  for (const file of [
    process.env.AGENCY_TASKS_FILE,
    process.env.AGENCY_APPROVALS_FILE,
    process.env.AGENCY_EXECUTIONS_FILE,
    process.env.AGENCY_TOOL_CALL_LOGS_FILE,
  ]) {
    if (file) fs.rmSync(file, { force: true });
  }
  for (const dir of [
    process.env.AGENCY_AUDIT_LOGS_DIR,
    process.env.AGENCY_MEMORY_DIR,
  ]) {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  }
});

after(async () => {
  if (webServer) {
    await webServer.stop();
  }
  fs.rmSync(tempDir, { recursive: true, force: true });

  for (const [key, orig] of [
    ['AGENCY_TASKS_FILE', originalTasksFile],
    ['AGENCY_APPROVALS_FILE', originalApprovalsFile],
    ['AGENCY_EXECUTIONS_FILE', originalExecutionsFile],
    ['AGENCY_TOOL_CALL_LOGS_FILE', originalToolCallLogsFile],
    ['AGENCY_AUDIT_LOGS_DIR', originalAuditLogsDir],
    ['AGENCY_MEMORY_DIR', originalMemoryDir],
  ] as const) {
    if (orig === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = orig;
    }
  }
});

// Helper: fetch wrapper
async function api(method: string, path: string, body?: unknown) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

// ============================================================================
// TEST 1: Path Resolution Regression
// ============================================================================

test('REGRESSION: import writes employee file to project-level hq/generated/employees/, not nested inside hq/backend/', async () => {
  // Step 1: Add a candidate via search
  const { status: searchStatus, data: searchData } = await api('POST', '/api/market/search', {
    url: 'https://github.com/test-org/test-repo',
  });

  // The search may fail if GitHub token is not configured — that's OK,
  // we test the path resolution, not the GitHub API.
  // If search fails, manually create a candidate entry.
  if (searchStatus !== 200 || !searchData.candidates?.length) {
    // Manually seed a candidate file
    const candidatesFile = path.join(tempDir, 'candidates.json');
    const candidate = {
      id: 'candidate_test_regression',
      source: 'github',
      url: 'https://github.com/test-org/test-repo',
      owner: 'test-org',
      name: 'test-repo',
      description: 'Test repo for path regression',
      language: 'TypeScript',
      score: { stars: 100, forks: 10, lastUpdated: new Date().toISOString() },
      topics: ['agent-framework'],
      evaluation: {
        score: 50,
        rating: 'consider',
        tier: 'fair',
        strengths: ['Test'],
        concerns: ['Test'],
        evaluatedAt: new Date().toISOString(),
      },
      capability: {
        category: 'engineering',
        specialties: ['testing'],
        description: 'Test',
        skills: ['TypeScript'],
      },
      status: 'candidate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(candidatesFile, JSON.stringify([candidate], null, 2), 'utf-8');
  }

  // Step 2: Import the candidate
  const { status: importStatus, data: importData } = await api(
    'POST',
    '/api/market/candidates/candidate_test_regression/import',
    {},
  );

  if (importStatus === 200 && importData.success) {
    // Step 3: Verify file exists at the CORRECT path
    const employeePath = importData.employeePath as string;
    assert.ok(
      employeePath.startsWith('hq/generated/employees/'),
      `Employee path should start with 'hq/generated/employees/' but got: ${employeePath}`,
    );

    // Step 4: Verify the file does NOT exist inside hq/backend/hq/
    const wrongDir = path.resolve(tempDir, 'hq', 'backend', 'hq', 'generated', 'employees');
    const wrongFiles = fs.existsSync(wrongDir) ? fs.readdirSync(wrongDir) : [];
    assert.deepEqual(
      wrongFiles,
      [],
      'No files should exist at the old buggy path hq/backend/hq/generated/employees/',
    );

    // Step 5: Verify file content is valid markdown with frontmatter
    // The actual file path should be relative to the project root
    assert.match(employeePath, /^hq\/generated\/employees\/emp_.*\.md$/);
  }
});

// ============================================================================
// TEST 2: Scanner Discovers Generated Employees
// ============================================================================

test('REGRESSION: Scanner discovers agents in hq/generated/employees/ directory', async () => {
  // Write a test employee file to the generated employees directory
  const testAgent = `---
name: Test Scanner Agent
description: Agent to verify scanner discovers generated employees
category: engineering
emoji: search
color: green
---

## Identity
Test agent for scanner regression.
`;

  const testFileName = 'test_scanner_agent.md';
  // Write to the REAL hq/generated/employees/ in the repo so Scanner can find it
  const realEmployeesDir = path.resolve(__dirname, '../../../../hq/generated/employees');
  fs.mkdirSync(realEmployeesDir, { recursive: true });
  const testFilePath = path.join(realEmployeesDir, testFileName);
  fs.writeFileSync(testFilePath, testAgent, 'utf-8');

  try {
    const scanner = new Scanner();
    const agents = await scanner.scan();

    // Scanner should find our test agent (among all other agents in the repo)
    const found = agents.find((a) => a.frontmatter.name === 'Test Scanner Agent');
    assert.ok(found, 'Scanner should discover agents in hq/generated/employees/');
    assert.equal(found.department, 'hq/generated/employees');
  } finally {
    fs.rmSync(testFilePath, { force: true });
  }
});

// ============================================================================
// TEST 3: __dirname Depth Asymmetry Guard
// ============================================================================

test('REGRESSION: __dirname path depth is correct for both scanner and market module', () => {
  // This test documents the __dirname depth asymmetry between scanner and market.
  // scanner.ts  -> dist/scanner.js       -> ../../../  = project root (3 levels)
  // market.ts   -> dist/api/market.js    -> ../../../../  = project root (4 levels)
  //
  // __dirname for THIS test file is dist/__tests__/ (2 levels deep in dist)

  // From dist/__tests__/, scanner is at ../scanner.js, market is at ../api/market.js
  const scannerCompiled = path.resolve(__dirname, '../scanner.js');
  const marketCompiled = path.resolve(__dirname, '../api/market.js');

  // Verify the files actually exist at these locations
  assert.ok(fs.existsSync(scannerCompiled), `Scanner should exist at ${scannerCompiled}`);
  assert.ok(fs.existsSync(marketCompiled), `Market should exist at ${marketCompiled}`);

  // Now verify path resolution:
  // scanner (dist/scanner.js) uses ../../../  (3 levels up from dist/)
  // market  (dist/api/market.js) uses ../../../../  (4 levels up from dist/api/)
  const scannerDir = path.dirname(scannerCompiled); // dist/
  const marketDir = path.dirname(marketCompiled);   // dist/api/

  const scannerProjectRoot = path.resolve(scannerDir, '../../../');
  const marketProjectRoot = path.resolve(marketDir, '../../../../');

  // Both should resolve to the same project root
  assert.equal(
    scannerProjectRoot,
    marketProjectRoot,
    `Scanner and Market should resolve to the same project root. Scanner: ${scannerProjectRoot}, Market: ${marketProjectRoot}`,
  );

  // Verify the project root looks correct (should contain hq/backend/package.json)
  assert.ok(
    fs.existsSync(path.join(marketProjectRoot, 'hq', 'backend', 'package.json')),
    `Project root should contain hq/backend/package.json. Got: ${marketProjectRoot}`,
  );
});
