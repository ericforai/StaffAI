import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscussionStartupCheck } from '../runtime/discussion-startup-check';

test('buildDiscussionStartupCheck reports missing local executors and disabled openai', () => {
  const result = buildDiscussionStartupCheck({
    preferredExecutor: 'claude',
    claudeReady: false,
    codexReady: false,
    geminiReady: false,
    openAiReady: false,
    discussionTimeoutMs: 240000,
    sandboxNetworkDisabled: false,
    claudePath: '/tmp/missing-claude',
    codexPath: '/tmp/missing-codex',
    geminiPath: '/tmp/missing-gemini',
  });

  assert.equal(result.preferredExecutor, 'claude');
  assert.equal(result.effectiveDefaultExecutor, 'claude');
  assert.equal(result.overallReady, false);
  assert.deepEqual(result.executorAttemptOrder, ['claude', 'gemini', 'codex', 'openai']);
  assert.equal(result.checks[0]?.status, 'missing');
  assert.equal(result.checks[1]?.status, 'missing');
  assert.equal(result.checks[2]?.status, 'missing');
  assert.equal(result.checks[3]?.status, 'disabled');
});

test('buildDiscussionStartupCheck reports the first available executor as effective default', () => {
  const result = buildDiscussionStartupCheck({
    preferredExecutor: 'codex',
    claudeReady: true,
    codexReady: false,
    geminiReady: false,
    openAiReady: true,
    discussionTimeoutMs: 240000,
    sandboxNetworkDisabled: true,
    claudePath: '/usr/bin/claude',
    codexPath: '/usr/bin/codex',
    geminiPath: '/usr/bin/gemini',
  });

  assert.equal(result.overallReady, true);
  assert.equal(result.checks[0]?.status, 'ready');
  assert.equal(result.checks[1]?.status, 'missing');
  assert.equal(result.executorAttemptOrder?.join(','), 'codex,claude,gemini,openai');
  assert.equal(result.effectiveDefaultExecutor, 'claude');
  assert.equal(result.checks[0]?.detail.includes('CODEX_SANDBOX_NETWORK_DISABLED=1'), true);
  assert.equal(result.checks[1]?.detail.includes('CODEX_SANDBOX_NETWORK_DISABLED=1'), false);
});
