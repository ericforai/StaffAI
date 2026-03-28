import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeAdapter, resolveRuntimeName } from '../runtime/runtime-adapter';

test('resolveRuntimeName maps executors to runtime names', () => {
  assert.equal(resolveRuntimeName('codex'), 'local_codex_cli');
  assert.equal(resolveRuntimeName('claude'), 'local_claude_cli');
  assert.equal(resolveRuntimeName('openai'), 'openai_api');
});

test('runtime adapters surface degraded output when Codex CLI fails', async () => {
  // Disable mock mode to test actual error handling
  const originalMode = process.env.AGENCY_TEST_MODE;
  delete process.env.AGENCY_TEST_MODE;

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
    timeoutMs: 1, // Very short timeout to trigger failure
    maxRetries: 0, // No retries to fail fast
  });

  // Should return degraded result when codex times out
  assert.ok(result.outputSummary.length > 0);
  assert.equal(result.outputSnapshot?.runtimeName, 'local_codex_cli');
  assert.equal(result.outputSnapshot?.executor, 'codex');
  assert.equal(result.outputSnapshot?.degraded, true);

  // Restore mock mode
  if (originalMode) process.env.AGENCY_TEST_MODE = originalMode;
});
