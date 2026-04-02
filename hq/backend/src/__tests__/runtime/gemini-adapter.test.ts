import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiRuntimeAdapter } from '../../runtime/adapters/gemini-adapter';
import type {
  RuntimeExecutionContext,
} from '../../runtime/runtime-adapter';

// Enable mock mode for tests
process.env.AGENCY_UNDER_NODE_TEST = '1';
process.env.AGENCY_TEST_MODE = 'mock';

function createMockContext(overrides?: Partial<RuntimeExecutionContext>): RuntimeExecutionContext {
  return {
    task: {
      id: 'task-gemini-1',
      title: 'Test Gemini task',
      description: 'A test task for Gemini',
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
    executor: 'gemini',
    runtimeName: 'local_gemini_cli',
    executionMode: 'single',
    summary: 'Test summary',
    timeoutMs: 30000,
    maxRetries: 1,
    ...overrides,
  };
}

test('GeminiRuntimeAdapter identifies itself correctly', () => {
  const adapter = new GeminiRuntimeAdapter();
  assert.equal(adapter.name, 'local_gemini_cli');
  assert.ok(adapter.supports.includes('parallel'));
});

test('GeminiRuntimeAdapter runs a single task context (mocked)', async () => {
  const adapter = new GeminiRuntimeAdapter();
  const context = createMockContext({ summary: 'Run gemini task' });
  const result = await adapter.run(context);

  assert.equal(result.outputSummary, 'Mocked Gemini output for testing');
  assert.ok(result.outputSnapshot);
  assert.equal(result.outputSnapshot.executor, 'gemini');
  assert.equal(result.outputSnapshot.degraded, false);
});

test('GeminiRuntimeAdapter handles execution failure when CLI is missing', async () => {
  // Temporarily disable mock mode to test error handling
  const originalMode = process.env.AGENCY_TEST_MODE;
  delete process.env.AGENCY_TEST_MODE;
  
  // Set an invalid path
  process.env.AGENCY_DISCUSSION_GEMINI_PATH = '/path/to/nowhere/gemini';

  const adapter = new GeminiRuntimeAdapter();
  const context = createMockContext({ summary: 'Fail task' });
  const result = await adapter.run(context);

  // Should return degraded result because path does not exist
  assert.ok(result.outputSummary.includes('Error executing gemini'));
  assert.ok(result.outputSnapshot?.degraded);
  assert.equal(result.outputSnapshot?.executor, 'gemini');

  // Restore
  if (originalMode) process.env.AGENCY_TEST_MODE = originalMode;
  delete process.env.AGENCY_DISCUSSION_GEMINI_PATH;
});
