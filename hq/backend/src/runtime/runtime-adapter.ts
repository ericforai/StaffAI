import type { TaskExecutionMode, TaskRecord } from '../shared/task-types';
import type { AgentMemory } from '../shared/intent-types';
import { ClaudeRuntimeAdapter } from './adapters/claude-adapter';
import { CodexRuntimeAdapter } from './adapters/codex-adapter';
import { GeminiRuntimeAdapter } from './adapters/gemini-adapter';
import { OpenAIRuntimeAdapter } from './adapters/openai-adapter';
import { DeerFlowRuntimeAdapter } from './adapters/deerflow-adapter';

export interface RuntimeExecutionContext {
  task: TaskRecord;
  executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow';
  runtimeName: string;
  assignmentId?: string;
  workflowStepId?: string;
  executionMode: TaskExecutionMode;
  summary: string;
  memoryContextExcerpt?: string;
  l3Memory?: AgentMemory;
  timeoutMs: number;
  maxRetries: number;
  inputSnapshot?: Record<string, unknown>;
  approvalGranted?: boolean;
  onEvent?: (event: { type: string; data: any }) => void;
}

/**
 * Executor-specific output metadata from runtime execution.
 * Contains only runtime-specific details, avoiding duplication with ExecutionRecord fields.
 */
export interface RuntimeOutputSnapshot extends Record<string, unknown> {
  runtimeName: string;
  executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow';
  executionMode: TaskExecutionMode;
  tokensUsed?: number;
  modelVersion?: string;
  responseTimeMs?: number;
  cacheStatus?: 'hit' | 'miss' | 'disabled';
  degraded?: boolean;
  fallbackReason?: string;
  simulated?: boolean;
  assignmentId?: string;
  workflowStepId?: string;
  memoryContextExcerpt?: string;
  inputSnapshot?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
}

export interface RuntimeExecutionResult {
  outputSummary: string;
  outputSnapshot?: RuntimeOutputSnapshot;
  /** When true, the agent needs human input before continuing */
  needsHumanInput?: boolean;
  /** Human input that was provided to continue */
  humanInput?: string;
}

export interface RuntimeExecutionError {
  code: 'timeout' | 'runtime_unavailable' | 'execution_failed' | 'unknown';
  message: string;
  retriable: boolean;
  details?: Record<string, unknown>;
}

export interface RuntimeAdapter {
  name: string;
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'>;
  run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
  runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]>;
  runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]>;
}

function mapExecutorToRuntimeName(executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow'): string {
  if (executor === 'codex') return 'local_codex_cli';
  if (executor === 'claude') return 'local_claude_cli';
  if (executor === 'gemini') return 'local_gemini_cli';
  if (executor === 'deerflow') return 'python_deerflow_workshop';
  return 'openai_api';
}

const ADAPTERS: Record<'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow', RuntimeAdapter> = {
  claude: new ClaudeRuntimeAdapter(),
  codex: new CodexRuntimeAdapter(),
  gemini: new GeminiRuntimeAdapter(),
  openai: new OpenAIRuntimeAdapter(),
  deerflow: new DeerFlowRuntimeAdapter(),
};

export function resolveRuntimeAdapter(executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow'): RuntimeAdapter {
  return ADAPTERS[executor];
}

export function resolveRuntimeName(executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow'): string {
  return mapExecutorToRuntimeName(executor);
}

/**
 * Common list of error keywords that indicate a retriable condition.
 */
export const RETRIABLE_ERROR_KEYWORDS = [
  'timed out',
  'timeout',
  'unavailable',
  'network',
  'rate limit',
  'overloaded',
  'busy',
];

/**
 * Determines if an error message or object is retriable based on common keywords.
 */
export function isRetriableError(error: unknown): boolean {
  if (!error) return false;
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return RETRIABLE_ERROR_KEYWORDS.some((keyword) => message.includes(keyword));
}

// Re-export adapter classes for external use
export { ClaudeRuntimeAdapter } from './adapters/claude-adapter';
export { CodexRuntimeAdapter } from './adapters/codex-adapter';
export { GeminiRuntimeAdapter } from './adapters/gemini-adapter';
export { OpenAIRuntimeAdapter } from './adapters/openai-adapter';
export { DeerFlowRuntimeAdapter } from './adapters/deerflow-adapter';
