import type { TaskExecutionMode, TaskRecord } from '../shared/task-types';
import { ClaudeRuntimeAdapter } from './adapters/claude-adapter';
import { CodexRuntimeAdapter } from './adapters/codex-adapter';

export interface RuntimeExecutionContext {
  task: TaskRecord;
  executor: 'claude' | 'codex' | 'openai';
  runtimeName: string;
  assignmentId?: string;
  workflowStepId?: string;
  executionMode: TaskExecutionMode;
  summary: string;
  memoryContextExcerpt?: string;
  timeoutMs: number;
  maxRetries: number;
  inputSnapshot?: Record<string, unknown>;
}

/**
 * Executor-specific output metadata from runtime execution.
 * Contains only runtime-specific details, avoiding duplication with ExecutionRecord fields.
 */
export interface RuntimeOutputSnapshot extends Record<string, unknown> {
  runtimeName: string;
  executor: 'claude' | 'codex' | 'openai';
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

function mapExecutorToRuntimeName(executor: 'claude' | 'codex' | 'openai'): string {
  if (executor === 'codex') return 'local_codex_cli';
  if (executor === 'claude') return 'local_claude_cli';
  return 'openai_api';
}

function createNoopAdapter(name: string): RuntimeAdapter {
  return {
    name,
    supports: ['single', 'serial', 'parallel', 'advanced_discussion'],
    async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
      return {
        outputSummary: context.summary,
        outputSnapshot: {
          runtimeName: 'openai_api',
          executor: 'openai',
          executionMode: context.executionMode,
          degraded: false,
        },
      };
    },
    async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
      const results: RuntimeExecutionResult[] = [];
      for (const context of contexts) {
        results.push({
          outputSummary: context.summary,
          outputSnapshot: {
            runtimeName: name,
            executor: context.executor,
            simulated: true,
            mode: 'serial',
          },
        });
      }
      return results;
    },
    async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
      return Promise.all(
        contexts.map((context) => ({
          outputSummary: context.summary,
          outputSnapshot: {
            runtimeName: name,
            executor: context.executor,
            simulated: true,
            mode: 'parallel',
          },
        }))
      );
    },
  };
}

const ADAPTERS: Record<'claude' | 'codex' | 'openai', RuntimeAdapter> = {
  claude: new ClaudeRuntimeAdapter(),
  codex: new CodexRuntimeAdapter(),
  openai: createNoopAdapter('openai_api'),
};

export function resolveRuntimeAdapter(executor: 'claude' | 'codex' | 'openai'): RuntimeAdapter {
  return ADAPTERS[executor];
}

export function resolveRuntimeName(executor: 'claude' | 'codex' | 'openai'): string {
  return mapExecutorToRuntimeName(executor);
}

// Re-export adapter classes for external use
export { ClaudeRuntimeAdapter } from './adapters/claude-adapter';
export { CodexRuntimeAdapter } from './adapters/codex-adapter';
