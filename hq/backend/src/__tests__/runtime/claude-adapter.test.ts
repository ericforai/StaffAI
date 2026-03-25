import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeRuntimeAdapter } from '../../runtime/adapters/claude-adapter';
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
    executor: 'claude',
    runtimeName: 'local_claude_cli',
    executionMode: 'single',
    summary: 'Test summary',
    timeoutMs: 30000,
    maxRetries: 1,
    ...overrides,
  };
}

test('ClaudeRuntimeAdapter identifies itself correctly', () => {
  const adapter = new ClaudeRuntimeAdapter();
  assert.equal(adapter.name, 'local_claude_cli');
  assert.ok(adapter.supports.includes('advanced_discussion'));
});

test('ClaudeRuntimeAdapter runs a single task context', async () => {
  const adapter = new ClaudeRuntimeAdapter();
  const context = createMockContext({ summary: 'Run test task' });
  const result = await adapter.run(context);

  assert.equal(result.outputSummary, 'Run test task');
  assert.ok(result.outputSnapshot);
  assert.equal(result.outputSnapshot.runtimeName, 'local_claude_cli');
  assert.equal(result.outputSnapshot.executor, 'claude');
});

test('ClaudeRuntimeAdapter runs tasks serially', async () => {
  const adapter = new ClaudeRuntimeAdapter();
  const contexts = [
    createMockContext({ summary: 'Task 1' }),
    createMockContext({ summary: 'Task 2' }),
  ];
  const results = await adapter.runSerial(contexts);

  assert.equal(results.length, 2);
  assert.equal(results[0].outputSummary, 'Task 1');
  assert.equal(results[1].outputSummary, 'Task 2');
});

test('ClaudeRuntimeAdapter runs tasks in parallel', async () => {
  const adapter = new ClaudeRuntimeAdapter();
  const contexts = [
    createMockContext({ summary: 'Parallel 1' }),
    createMockContext({ summary: 'Parallel 2' }),
  ];
  const results = await adapter.runParallel(contexts);

  assert.equal(results.length, 2);
  assert.equal(results[0].outputSummary, 'Parallel 1');
  assert.equal(results[1].outputSummary, 'Parallel 2');
});

test('ClaudeRuntimeAdapter.createDegradedResult creates fallback output', () => {
  const adapter = new ClaudeRuntimeAdapter();
  const context = createMockContext({ summary: 'Original task' });

  // Access protected method via type assertion for testing
  const degradedResult = (adapter as unknown as {
    createDegradedResult: (c: RuntimeExecutionContext, r: string) => RuntimeExecutionResult,
  }).createDegradedResult(context, 'Runtime service unavailable');

  assert.equal(degradedResult.outputSummary, '[Degraded] Original task');
  assert.ok(degradedResult.outputSnapshot);
  assert.equal(degradedResult.outputSnapshot.degraded, true);
  assert.equal(degradedResult.outputSnapshot.fallbackReason, 'Runtime service unavailable');
  assert.equal(degradedResult.outputSnapshot.runtimeName, 'local_claude_cli');
  assert.equal(degradedResult.outputSnapshot.executor, 'claude');
});
