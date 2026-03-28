import test from 'node:test';
import assert from 'node:assert/strict';
import { CodexRuntimeAdapter } from '../../runtime/adapters/codex-adapter';
import type {
  RuntimeExecutionContext,
} from '../../runtime/runtime-adapter';

// Enable mock mode for tests
process.env.AGENCY_UNDER_NODE_TEST = '1';
process.env.AGENCY_TEST_MODE = 'mock';

function createMockContext(overrides?: Partial<RuntimeExecutionContext>): RuntimeExecutionContext {
  return {
    task: {
      id: 'task-1',
      title: 'Test task',
      description: 'A test task',
      taskType: 'general',
      priority: 'medium',
      status: 'running',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      requestedBy: 'user',
      requestedAt: new Date().toISOString(),
      recommendedAgentRole: 'developer',
      candidateAgentRoles: [],
      routeReason: 'test',
      routingStatus: 'matched',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    executor: 'codex',
    runtimeName: 'local_codex_cli',
    executionMode: 'single',
    summary: 'Test summary',
    timeoutMs: 30000,
    maxRetries: 1,
    ...overrides,
  };
}

test('CodexRuntimeAdapter identifies itself correctly', () => {
  const adapter = new CodexRuntimeAdapter();
  assert.equal(adapter.name, 'local_codex_cli');
  assert.ok(adapter.supports.includes('parallel'));
});

test('CodexRuntimeAdapter runs a single task context', async () => {
  const adapter = new CodexRuntimeAdapter();
  const context = createMockContext({ summary: 'Run codex task' });
  const result = await adapter.run(context);

  assert.equal(result.outputSummary, 'Mocked Codex output for testing');
  assert.ok(result.outputSnapshot);
  assert.equal(result.outputSnapshot.executor, 'codex');
  assert.equal(result.outputSnapshot.degraded, false);
});

test('CodexRuntimeAdapter handles execution failure', async () => {
  // Temporarily disable mock mode to test error handling
  const originalMode = process.env.AGENCY_TEST_MODE;
  delete process.env.AGENCY_TEST_MODE;

  const adapter = new CodexRuntimeAdapter();
  const context = createMockContext({ summary: 'Fail task' });
  const result = await adapter.run(context);

  // Should return degraded result when codex CLI is not available
  assert.ok(result.outputSummary.includes('Error executing codex'));
  assert.ok(result.outputSnapshot?.degraded);
  assert.equal(result.outputSnapshot?.executor, 'codex');

  // Restore mock mode
  if (originalMode) process.env.AGENCY_TEST_MODE = originalMode;
});
