import type { ExecutorName } from './discussion-types';

export function resolveExecutorPreference(raw: string | undefined): ExecutorName {
  const normalized = (raw || 'claude').toLowerCase();
  if (normalized === 'codex' || normalized === 'claude' || normalized === 'openai') {
    return normalized;
  }
  return 'claude';
}

export function resolveExecutorAttempts(preferred: ExecutorName): ExecutorName[] {
  if (preferred === 'codex') {
    return ['codex', 'claude', 'openai'];
  }

  if (preferred === 'openai') {
    return ['openai', 'claude', 'codex'];
  }

  return ['claude', 'codex', 'openai'];
}

export function buildExecutorEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...baseEnv };
  delete env.CODEX_SANDBOX_NETWORK_DISABLED;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

export function buildAgentPrompt(systemPrompt: string, userPrompt: string): string {
  return [
    '你是 The Agency HQ 为单个专家分配的独立执行代理。',
    '',
    '请严格按照下面的 system prompt 扮演该专家，并只返回专家自己的最终专业分析。',
    '不要解释你使用了什么工具，也不要输出额外前言。',
    '',
    '=== SYSTEM PROMPT ===',
    systemPrompt,
    '',
    '=== USER TASK ===',
    userPrompt,
  ].join('\n');
}

export function extractStructuredResponse(raw: string, executor: ExecutorName): string {
  const text = raw.trim();
  if (!text) {
    throw new Error(`${executor} 未返回文本结果。`);
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const direct = typeof parsed.response === 'string' ? parsed.response.trim() : null;
    if (direct) {
      return direct;
    }

    const nested =
      typeof parsed.result === 'object' && parsed.result !== null
        ? (parsed.result as Record<string, unknown>)
        : null;
    const nestedResult = typeof nested?.response === 'string' ? nested.response.trim() : null;
    if (nestedResult) {
      return nestedResult;
    }

    const content = Array.isArray(parsed.content) ? (parsed.content as Array<Record<string, unknown>>) : null;
    const contentText = content
      ? content
          .map((entry) => (typeof entry.text === 'string' ? entry.text : ''))
          .join('\n')
          .trim()
      : '';
    if (contentText) {
      return contentText;
    }
  } catch {
    // Fall back to plain text if the CLI is configured to emit plain output.
  }

  return text;
}

export function formatExecutorError(error: unknown, _executor: ExecutorName, fallback: string): Error {
  if (!(error instanceof Error)) {
    return new Error(fallback);
  }

  const details: string[] = [];
  const childLike = error as Error & { stdout?: string; stderr?: string };
  const stderr = typeof childLike.stderr === 'string' ? childLike.stderr.trim() : '';
  const stdout = typeof childLike.stdout === 'string' ? childLike.stdout.trim() : '';

  if (stderr) {
    details.push(`stderr: ${stderr}`);
  }
  if (stdout && stdout !== stderr) {
    details.push(`stdout: ${stdout}`);
  }

  if (details.length === 0) {
    return new Error(error.message || fallback);
  }

  return new Error(`${error.message || fallback} (${details.join(' | ')})`);
}
