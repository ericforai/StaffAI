import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildAgentL3MemoryContext } from '../prompt-builder';
import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult, RuntimeOutputSnapshot } from '../runtime-adapter';

const execFileAsync = promisify(execFile);

export class CodexRuntimeAdapter implements RuntimeAdapter {
  name = 'local_codex_cli';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private async executeLocal(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const startTime = Date.now();

    // Test mode: return mock data
    if (process.env.AGENCY_UNDER_NODE_TEST === '1' && process.env.AGENCY_TEST_MODE === 'mock') {
      return {
        outputSummary: 'Mocked Codex output for testing',
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'codex',
          executionMode: context.executionMode,
          degraded: false,
          responseTimeMs: Date.now() - startTime,
        },
      };
    }

    try {
      // Build the prompt for the local CLI
      const taskDescription = context.task.description || context.task.title;
      const l3MemoryContext = buildAgentL3MemoryContext(context.l3Memory ?? null);
      const fullPrompt = `${taskDescription}\n\n${l3MemoryContext}\n\nContext:\n${context.summary}`;

      // Use 'codex exec' subcommand for non-interactive execution
      // Codex automatically uses configured MCP servers
      const { stdout } = await execFileAsync('codex', ['exec', '--ephemeral', '--json', fullPrompt], {
        timeout: context.timeoutMs || 120000,
        maxBuffer: 1024 * 1024 * 8,
      });

      const responseTimeMs = Date.now() - startTime;
      const outputSnapshot: RuntimeOutputSnapshot = {
        runtimeName: this.name,
        executor: 'codex',
        executionMode: context.executionMode,
        responseTimeMs,
        degraded: false,
        simulated: false,
      };

      return {
        outputSummary: stdout.trim() || 'No output from codex',
        outputSnapshot,
      };
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      return {
        outputSummary: `Error executing codex: ${error.message}`,
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'codex',
          executionMode: context.executionMode,
          responseTimeMs,
          degraded: true,
          fallbackReason: error.message,
        },
      };
    }
  }

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    return this.executeLocal(context);
  }

  async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    const results: RuntimeExecutionResult[] = [];
    for (const context of contexts) {
      results.push(await this.executeLocal(context));
    }
    return results;
  }

  async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    // For local CLI, we might want to limit parallelism to avoid overloading
    // but here we follow the request
    return Promise.all(contexts.map((c) => this.executeLocal(c)));
  }
}
