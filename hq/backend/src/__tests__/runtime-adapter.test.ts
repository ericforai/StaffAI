import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeAdapter, resolveRuntimeName } from '../runtime/runtime-adapter';

test('resolveRuntimeName maps executors to runtime names', () => {
  assert.equal(resolveRuntimeName('codex'), 'local_codex_cli');
  assert.equal(resolveRuntimeName('claude'), 'local_claude_cli');
  assert.equal(resolveRuntimeName('openai'), 'openai_api');
});

test('runtime adapters surface degraded output when Codex CLI fails', async () => {
  const adapter = resolveRuntimeAdapter('codex');
  const result = await adapter.run({
    task: {
      id: 'task-1',
      title: 'Runtime adapter baseline',
      description: 'Ensure adapter contract returns structured output',
      taskType: 'general',
      priority: 'medium',
      status: 'running',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      requestedBy: 'system',
      requestedAt: '2026-03-25T00:00:00.000Z',
      recommendedAgentRole: 'dispatcher',
      candidateAgentRoles: ['dispatcher'],
      routeReason: 'runtime test',
      routingStatus: 'manual_review',
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
    executor: 'codex',
    runtimeName: 'local_codex_cli',
    executionMode: 'single',
    summary: 'ok',
    timeoutMs: 1000,
    maxRetries: 1,
  });

  assert.match(result.outputSummary, /^Error executing codex:/);
  assert.equal(result.outputSnapshot?.runtimeName, 'local_codex_cli');
  assert.equal(result.outputSnapshot?.executor, 'codex');
  assert.equal(result.outputSnapshot?.degraded, true);
  assert.equal(typeof result.outputSnapshot?.fallbackReason, 'string');
});
