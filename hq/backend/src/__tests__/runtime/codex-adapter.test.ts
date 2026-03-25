import test from 'node:test';
import assert from 'node:assert/strict';
import { CodexRuntimeAdapter } from '../../runtime/adapters/codex-adapter';
import type {
  RuntimeExecutionContext,
  RuntimeExecutionResult,
} from '../../runtime/runtime-adapter';

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
  assert.ok(!adapter.supports.includes('advanced_discussion'));
});

test('CodexRuntimeAdapter runs a single task context', async () => {
  const adapter = new CodexRuntimeAdapter();
  const context = createMockContext({ summary: 'Run codex task' });
  const result = await adapter.run(context);

  assert.equal(result.outputSummary, 'Run codex task');
  assert.ok(result.outputSnapshot);
  assert.equal(result.outputSnapshot.runtimeName, 'local_codex_cli');
  assert.equal(result.outputSnapshot.executor, 'codex');
});

test('CodexRuntimeAdapter runs tasks serially', async () => {
  const adapter = new CodexRuntimeAdapter();
  const contexts = [
    createMockContext({ summary: 'Codex 1' }),
    createMockContext({ summary: 'Codex 2' }),
  ];
  const results = await adapter.runSerial(contexts);

  assert.equal(results.length, 2);
  assert.equal(results[0].outputSummary, 'Codex 1');
  assert.equal(results[1].outputSummary, 'Codex 2');
});

test('CodexRuntimeAdapter runs tasks in parallel', async () => {
  const adapter = new CodexRuntimeAdapter();
  const contexts = [
    createMockContext({ summary: 'Codex Parallel 1' }),
    createMockContext({ summary: 'Codex Parallel 2' }),
  ];
  const results = await adapter.runParallel(contexts);

  assert.equal(results.length, 2);
  assert.equal(results[0].outputSummary, 'Codex Parallel 1');
  assert.equal(results[1].outputSummary, 'Codex Parallel 2');
});

test('CodexRuntimeAdapter.createDegradedResult creates fallback output', () => {
  const adapter = new CodexRuntimeAdapter();
  const context = createMockContext({ summary: 'Original codex task' });

  // Access protected method via type assertion for testing
  const degradedResult = (adapter as unknown as {
    createDegradedResult: (c: RuntimeExecutionContext, r: string) => RuntimeExecutionResult,
  }).createDegradedResult(context, 'Codex CLI not found');

  assert.equal(degradedResult.outputSummary, '[Degraded] Original codex task');
  assert.ok(degradedResult.outputSnapshot);
  assert.equal(degradedResult.outputSnapshot.degraded, true);
  assert.equal(degradedResult.outputSnapshot.fallbackReason, 'Codex CLI not found');
  assert.equal(degradedResult.outputSnapshot.runtimeName, 'local_codex_cli');
  assert.equal(degradedResult.outputSnapshot.executor, 'codex');
});
