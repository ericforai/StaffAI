import { resolveExecutorAttempts } from './discussion-executor';
import type { ExecutorName, StartupCheckResult } from './discussion-types';

interface DiscussionStartupCheckInput {
  preferredExecutor: ExecutorName;
  claudeReady: boolean;
  codexReady: boolean;
  geminiReady: boolean;
  openAiReady: boolean;
  discussionTimeoutMs: number;
  sandboxNetworkDisabled: boolean;
  claudePath: string;
  codexPath: string;
  geminiPath: string;
}

export function buildDiscussionStartupCheck(input: DiscussionStartupCheckInput): StartupCheckResult {
  const attemptOrder = resolveExecutorAttempts(input.preferredExecutor);
  const claudeStatus: 'ready' | 'missing' = input.claudeReady ? 'ready' : 'missing';
  const codexStatus: 'ready' | 'missing' = input.codexReady ? 'ready' : 'missing';
  const geminiStatus: 'ready' | 'missing' = input.geminiReady ? 'ready' : 'missing';
  const openAiStatus: 'ready' | 'disabled' = input.openAiReady ? 'ready' : 'disabled';

  const checks = [
    {
      name: 'claude' as const,
      configured: true,
      available: input.claudeReady,
      status: claudeStatus,
      detail: input.claudeReady
        ? input.sandboxNetworkDisabled
          ? `Claude Code CLI 已就绪: ${input.claudePath}。检测到上游进程设置了 CODEX_SANDBOX_NETWORK_DISABLED=1，HQ 会在拉起子进程时主动清理该环境变量。`
          : `Claude Code CLI 已就绪: ${input.claudePath}`
        : `未找到 Claude Code CLI: ${input.claudePath}`,
    },
    {
      name: 'codex' as const,
      configured: true,
      available: input.codexReady,
      status: codexStatus,
      detail: input.codexReady
        ? input.sandboxNetworkDisabled
          ? `Codex CLI 已安装: ${input.codexPath}。检测到上游进程设置了 CODEX_SANDBOX_NETWORK_DISABLED=1，HQ 会在拉起子进程时主动清理该环境变量。`
          : `Codex CLI 已安装: ${input.codexPath}`
        : `未找到 Codex CLI: ${input.codexPath}`,
    },
    {
      name: 'gemini' as const,
      configured: true,
      available: input.geminiReady,
      status: geminiStatus,
      detail: input.geminiReady
        ? input.sandboxNetworkDisabled
          ? `Gemini CLI 已安装: ${input.geminiPath}。检测到上游进程设置了 CODEX_SANDBOX_NETWORK_DISABLED=1，HQ 会在拉起子进程时主动清理该环境变量。`
          : `Gemini CLI 已安装: ${input.geminiPath}`
        : `未找到 Gemini CLI: ${input.geminiPath}`,
    },
    {
      name: 'openai' as const,
      configured: input.openAiReady,
      available: input.openAiReady,
      status: openAiStatus,
      detail: input.openAiReady ? '已配置 OPENAI_API_KEY，可作为回退执行器。' : '未配置 OPENAI_API_KEY，云端回退已关闭。',
    },
  ];
  const availability = new Map<ExecutorName, boolean>([
    ['claude', input.claudeReady],
    ['codex', input.codexReady],
    ['gemini', input.geminiReady],
    ['openai', input.openAiReady],
  ]);
  const effectiveDefaultExecutor =
    attemptOrder.find((executor) => availability.get(executor)) ?? attemptOrder[0];

  return {
    preferredExecutor: input.preferredExecutor,
    effectiveDefaultExecutor,
    executorAttemptOrder: attemptOrder,
    discussionTimeoutMs: input.discussionTimeoutMs,
    overallReady: checks.some((check) => check.available),
    checks,
  };
}
