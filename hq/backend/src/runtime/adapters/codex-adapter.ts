import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult, RuntimeOutputSnapshot } from '../runtime-adapter';

const execAsync = promisify(exec);

export class CodexRuntimeAdapter implements RuntimeAdapter {
  name = 'local_codex_cli';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private async executeLocal(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const startTime = Date.now();
    try {
      // Build the prompt for the local CLI
      // We pass the summary and description as the task to execute
      const taskDescription = context.task.description || context.task.title;
      const fullPrompt = `${taskDescription}\n\nContext:\n${context.summary}`;

      // Escape for shell
      const escapedPrompt = JSON.stringify(fullPrompt);

      // Execute the local codex command
      // We assume 'codex' is in the PATH as verified by the startup check
      const { stdout } = await execAsync(`codex ${escapedPrompt}`, { timeout: 120000 });

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
