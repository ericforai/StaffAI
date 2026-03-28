import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildExecutorEnv, extractStructuredResponse, formatExecutorError } from '../discussion-executor';
import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult, RuntimeOutputSnapshot } from '../runtime-adapter';

const execFileAsync = promisify(execFile);

/**
 * Allowed MCP tools for agent execution.
 * Only search-related tools are permitted; file system write and dangerous operations are blocked.
 */
const ALLOWED_TOOL_PATTERNS = [
  'mcp__web-readers__*',
  'mcp__web-reader__*',
  'WebSearch',
];

const AGENT_SYSTEM_PROMPT = `You are an AI agent with access to web search tools.
You can search the internet to gather current information, but cannot directly modify files.
When you need to make code changes, explain them clearly instead of editing directly.`;

export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  name = 'local_claude_cli';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = [
    'single',
    'serial',
    'parallel',
    'advanced_discussion',
  ];

  private resolveClaudePath(): string {
    return process.env.AGENCY_TASK_CLAUDE_PATH || process.env.AGENCY_DISCUSSION_CLAUDE_PATH || 'claude';
  }

  private buildArgs(prompt: string): string[] {
    return [
      '-p',
      '--output-format',
      'json',
      '--no-session-persistence',
      '--permission-mode',
      'bypassPermissions',
      '--allowed-tools',
      ALLOWED_TOOL_PATTERNS.join(','),
      '--system-prompt',
      AGENT_SYSTEM_PROMPT,
      prompt,
    ];
  }

  private async execute(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const startedAt = Date.now();

    // Test mode: return mock data
    if (process.env.AGENCY_UNDER_NODE_TEST === '1' && process.env.AGENCY_TEST_MODE === 'mock') {
      return {
        outputSummary: 'Mocked Claude output for testing',
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'claude',
          executionMode: context.executionMode,
          degraded: false,
          responseTimeMs: Date.now() - startedAt,
        },
      };
    }

    const claudePath = this.resolveClaudePath();
    const taskDescription = context.task.description || context.task.title;
    const prompt = `${taskDescription}\n\nContext:\n${context.summary}`;

    try {
      const result = await execFileAsync(
        claudePath,
        this.buildArgs(prompt),
        {
          env: buildExecutorEnv(process.env),
          timeout: context.timeoutMs || 120000,
          maxBuffer: 1024 * 1024 * 8,
        }
      );

      const outputSummary = extractStructuredResponse(result.stdout || '', 'claude');
      const outputSnapshot: RuntimeOutputSnapshot = {
        runtimeName: this.name,
        executor: 'claude',
        executionMode: context.executionMode,
        degraded: false,
        responseTimeMs: Date.now() - startedAt,
      };

      return {
        outputSummary,
        outputSnapshot,
      };
    } catch (error) {
      const formatted = formatExecutorError(error, 'claude', 'Claude execution failed.');
      return this.createDegradedResult(context, formatted.message);
    }
  }

  private createDegradedResult(context: RuntimeExecutionContext, reason: string): RuntimeExecutionResult {
    return {
      outputSummary: `Error executing claude: ${reason}`,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'claude',
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
