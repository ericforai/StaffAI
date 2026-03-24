import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentPrompt,
  buildExecutorEnv,
  extractStructuredResponse,
  formatExecutorError,
  resolveExecutorPreference,
} from '../runtime/discussion-executor';

test('resolveExecutorPreference accepts known executors and falls back to claude', () => {
  assert.equal(resolveExecutorPreference('codex'), 'codex');
  assert.equal(resolveExecutorPreference('openai'), 'openai');
  assert.equal(resolveExecutorPreference('unknown'), 'claude');
  assert.equal(resolveExecutorPreference(undefined), 'claude');
});

test('buildExecutorEnv removes sandbox-specific env vars', () => {
  const env = buildExecutorEnv({
    CODEX_SANDBOX_NETWORK_DISABLED: '1',
    CLAUDE_CODE_ENTRYPOINT: 'yes',
    KEEP_ME: 'ok',
  });

  assert.equal(env.CODEX_SANDBOX_NETWORK_DISABLED, undefined);
  assert.equal(env.CLAUDE_CODE_ENTRYPOINT, undefined);
  assert.equal(env.KEEP_ME, 'ok');
});

test('buildAgentPrompt embeds system and user task sections', () => {
  const prompt = buildAgentPrompt('system prompt', 'user task');
  assert.equal(prompt.includes('=== SYSTEM PROMPT ==='), true);
  assert.equal(prompt.includes('system prompt'), true);
  assert.equal(prompt.includes('=== USER TASK ==='), true);
  assert.equal(prompt.includes('user task'), true);
});

test('extractStructuredResponse prefers response field from structured output', () => {
  const text = extractStructuredResponse(JSON.stringify({ response: 'final answer' }), 'codex');
  assert.equal(text, 'final answer');
});

test('extractStructuredResponse falls back to plain text when json parse fails', () => {
  const text = extractStructuredResponse('plain text answer', 'claude');
  assert.equal(text, 'plain text answer');
});

test('formatExecutorError includes stdout and stderr details when available', () => {
  const error = Object.assign(new Error('failed'), {
    stdout: 'partial output',
    stderr: 'stderr output',
  });

  const formatted = formatExecutorError(error, 'codex', 'fallback');
  assert.equal(formatted.message.includes('stderr output'), true);
  assert.equal(formatted.message.includes('partial output'), true);
});
