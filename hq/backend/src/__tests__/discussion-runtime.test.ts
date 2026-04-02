import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DiscussionRuntime } from '../runtime/discussion-runtime';

const originalExecutor = process.env.AGENCY_DISCUSSION_EXECUTOR;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalSandboxFlag = process.env.CODEX_SANDBOX_NETWORK_DISABLED;

test('discussion runtime startup check reflects unavailable local executors', async () => {
  const runtime = new DiscussionRuntime({
    workspaceRoot: path.resolve(__dirname, '../../..'),
    claudePath: '/path/does/not/exist/claude',
    codexPath: '/path/does/not/exist/codex',
    geminiPath: '/path/does/not/exist/gemini',
  });

  const status = await runtime.getStartupCheck();
  assert.equal(status.checks.some((check) => check.name === 'claude' && check.available === false), true);
  assert.equal(status.checks.some((check) => check.name === 'codex' && check.available === false), true);
});

test('discussion runtime returns explicit executor failure when configured executor is unavailable', async () => {
  process.env.AGENCY_DISCUSSION_EXECUTOR = 'codex';
  delete process.env.OPENAI_API_KEY;
  process.env.CODEX_SANDBOX_NETWORK_DISABLED = '1';

  const runtime = new DiscussionRuntime({
    workspaceRoot: path.resolve(__dirname, '../../..'),
    claudePath: '/path/does/not/exist/claude',
    codexPath: '/path/does/not/exist/codex',
    geminiPath: '/path/does/not/exist/gemini',
  });

  try {
    await runtime.generateText('system', 'user');
    assert.fail('expected runtime.generateText to throw');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /没有可用的讨论执行器/);
    assert.match(message, /codex/i);
  } finally {
    if (originalExecutor === undefined) {
      delete process.env.AGENCY_DISCUSSION_EXECUTOR;
    } else {
      process.env.AGENCY_DISCUSSION_EXECUTOR = originalExecutor;
    }
    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
    if (originalSandboxFlag === undefined) {
      delete process.env.CODEX_SANDBOX_NETWORK_DISABLED;
    } else {
      process.env.CODEX_SANDBOX_NETWORK_DISABLED = originalSandboxFlag;
    }
  }
});

test('discussion runtime falls back to the next executor when the preferred one fails', async () => {
  const previousExecutor = process.env.AGENCY_DISCUSSION_EXECUTOR;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousSandboxFlag = process.env.CODEX_SANDBOX_NETWORK_DISABLED;

  process.env.AGENCY_DISCUSSION_EXECUTOR = 'codex';
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.CODEX_SANDBOX_NETWORK_DISABLED;

  const runtime = new DiscussionRuntime({
    workspaceRoot: path.resolve(__dirname, '../../..'),
    claudePath: '/path/does/not/exist/claude',
    codexPath: '/path/does/not/exist/codex',
    geminiPath: '/path/does/not/exist/gemini',
  });

  const stubbedRuntime = runtime as unknown as {
    runCodex: () => Promise<string>;
    runClaude: () => Promise<string>;
    runOpenAI: () => Promise<string>;
  };
  stubbedRuntime.runCodex = async () => {
    throw new Error('codex failed');
  };
  let claudeCalls = 0;
  stubbedRuntime.runClaude = async () => {
    claudeCalls += 1;
    return 'claude fallback';
  };
  let openAiCalls = 0;
  stubbedRuntime.runOpenAI = async () => {
    openAiCalls += 1;
    return 'openai fallback';
  };

  try {
    const result = await runtime.generateText('system', 'user');
    assert.equal(result.text, 'claude fallback');
    assert.equal(result.executor, 'claude');
    assert.equal(claudeCalls, 1);
    assert.equal(openAiCalls, 0);
  } finally {
    if (previousExecutor === undefined) {
      delete process.env.AGENCY_DISCUSSION_EXECUTOR;
    } else {
      process.env.AGENCY_DISCUSSION_EXECUTOR = previousExecutor;
    }
    if (previousOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAIKey;
    }
    if (previousSandboxFlag === undefined) {
      delete process.env.CODEX_SANDBOX_NETWORK_DISABLED;
    } else {
      process.env.CODEX_SANDBOX_NETWORK_DISABLED = previousSandboxFlag;
    }
  }
});
