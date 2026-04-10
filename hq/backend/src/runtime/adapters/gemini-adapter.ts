import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildExecutorEnv, extractStructuredResponse, formatExecutorError } from '../discussion-executor';
import { buildAgentL3MemoryContext } from '../prompt-builder';
import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult, RuntimeOutputSnapshot } from '../runtime-adapter';

const execFileAsync = promisify(execFile);

/**
 * Gemini CLI adapter for StaffAI HQ.
 */
export class GeminiRuntimeAdapter implements RuntimeAdapter {
  name = 'local_gemini_cli';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = [
    'single',
    'serial',
    'parallel',
    'advanced_discussion',
  ];

  private resolveGeminiPath(): string {
    return process.env.AGENCY_TASK_GEMINI_PATH || process.env.AGENCY_DISCUSSION_GEMINI_PATH || 'gemini';
  }

  private buildArgs(prompt: string, systemPrompt: string): string[] {
    // Note: Gemini CLI uses -p for prompt (non-interactive) and -o for output format
    return [
      '-p',
      `${systemPrompt}\n\nTask:\n${prompt}`,
      '-o',
      'json',
      '--approval-mode',
      'yolo', // Use YOLO mode for automated execution
      '--sandbox', // Enable sandboxing
    ];
  }

  private async execute(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const startedAt = Date.now();

    // Test mode: return mock data
    if (process.env.AGENCY_UNDER_NODE_TEST === '1' && process.env.AGENCY_TEST_MODE === 'mock') {
      return {
        outputSummary: context.summary || 'Mocked Gemini output for testing',
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'gemini',
          executionMode: context.executionMode,
          degraded: false,
          responseTimeMs: Date.now() - startedAt,
        },
      };
    }

    const geminiPath = this.resolveGeminiPath();
    const taskDescription = context.task.description || context.task.title;
    const prompt = `${taskDescription}\n\nContext:\n${context.summary}`;

    const l3MemoryContext = buildAgentL3MemoryContext(context.l3Memory ?? null);
    const systemPrompt = `You are an AI expert assistant. ${l3MemoryContext}`;

    try {
      const result = await execFileAsync(
        geminiPath,
        this.buildArgs(prompt, systemPrompt),
        {
          env: buildExecutorEnv(process.env),
          timeout: context.timeoutMs || 240000, // Gemini might take longer for complex tasks
          maxBuffer: 1024 * 1024 * 16, // 16MB buffer
        }
      );

      const outputSummary = extractStructuredResponse(result.stdout || '', 'gemini');
      const outputSnapshot: RuntimeOutputSnapshot = {
        runtimeName: this.name,
        executor: 'gemini',
        executionMode: context.executionMode,
        degraded: false,
        responseTimeMs: Date.now() - startedAt,
      };

      return {
        outputSummary,
        outputSnapshot,
      };
    } catch (error) {
      const formatted = formatExecutorError(error, 'gemini', 'Gemini execution failed.');
      return this.createDegradedResult(context, formatted.message);
    }
  }

  private createDegradedResult(context: RuntimeExecutionContext, reason: string): RuntimeExecutionResult {
    return {
      outputSummary: `Error executing gemini: ${reason}`,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'gemini',
        executionMode: context.executionMode,
        degraded: true,
        fallbackReason: reason,
      },
    };
  }

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    return this.execute(context);
  }

  async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    const results: RuntimeExecutionResult[] = [];
    for (const context of contexts) {
      results.push(await this.execute(context));
    }
    return results;
  }

  async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    return Promise.all(contexts.map((context) => this.execute(context)));
  }
}
