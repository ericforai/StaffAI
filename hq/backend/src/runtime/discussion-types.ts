export type ExecutorName = 'codex' | 'claude' | 'openai';
export type ExecutorPreference = 'auto' | ExecutorName;

export interface ExecutorCheck {
  name: ExecutorName;
  configured: boolean;
  available: boolean;
  status: 'ready' | 'missing' | 'disabled';
  detail: string;
}

export interface StartupCheckResult {
  preferredExecutor: ExecutorPreference;
  effectiveDefaultExecutor: ExecutorName;
  executorAttemptOrder?: ExecutorName[];
  discussionTimeoutMs: number;
  overallReady: boolean;
  checks: ExecutorCheck[];
}
