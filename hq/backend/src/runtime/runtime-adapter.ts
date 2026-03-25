import type { TaskExecutionMode, TaskRecord } from '../shared/task-types';

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

export interface RuntimeExecutionResult {
  outputSummary: string;
  outputSnapshot?: Record<string, unknown>;
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
    async run(context) {
      return {
        outputSummary: context.summary,
        outputSnapshot: {
          runtimeName: name,
          executor: context.executor,
          simulated: true,
        },
      };
    },
  };
}

const ADAPTERS: Record<'claude' | 'codex' | 'openai', RuntimeAdapter> = {
  codex: createNoopAdapter('local_codex_cli'),
  claude: createNoopAdapter('local_claude_cli'),
  openai: createNoopAdapter('openai_api'),
};

export function resolveRuntimeAdapter(executor: 'claude' | 'codex' | 'openai'): RuntimeAdapter {
  return ADAPTERS[executor];
}

export function resolveRuntimeName(executor: 'claude' | 'codex' | 'openai'): string {
  return mapExecutorToRuntimeName(executor);
}
