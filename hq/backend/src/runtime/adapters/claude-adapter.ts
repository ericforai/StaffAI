import type {
  RuntimeAdapter,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeOutputSnapshot,
} from '../runtime-adapter';

/**
 * ClaudeRuntimeAdapter provides execution capabilities for the Claude AI runtime.
 * Supports single, serial, parallel, and advanced discussion execution modes.
 */
export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly name = 'local_claude_cli';
  readonly supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = [
    'single',
    'serial',
    'parallel',
    'advanced_discussion',
  ];

  /**
   * Execute a single task context through Claude runtime.
   */
  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    return this.executeWithContext(context);
  }

  /**
   * Execute multiple contexts sequentially (one after another).
   * Each execution completes before the next begins.
   */
  async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    const results: RuntimeExecutionResult[] = [];

    for (const context of contexts) {
      const result = await this.executeWithContext(context);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute multiple contexts concurrently (in parallel).
   * All executions start simultaneously.
   */
  async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    const promises = contexts.map((context) => this.executeWithContext(context));
    return Promise.all(promises);
  }

  /**
   * Internal execution method that handles the actual runtime invocation.
   * In production, this would delegate to the Claude CLI or API.
   * For now, returns a simulated result matching the expected interface.
   */
  private async executeWithContext(
    context: RuntimeExecutionContext,
  ): Promise<RuntimeExecutionResult> {
    const startTime = Date.now();

    // In production implementation, this would:
    // 1. Build the prompt from context
    // 2. Invoke Claude via CLI or API
    // 3. Parse and return the response

    const responseTimeMs = Date.now() - startTime;

    // Create executor-specific output snapshot (no duplication with ExecutionRecord)
    const outputSnapshot: RuntimeOutputSnapshot = {
      runtimeName: this.name,
      executor: context.executor,
      executionMode: context.executionMode,
      responseTimeMs,
      degraded: false,
      simulated: true,
    };

    // Simulated execution response
    return {
      outputSummary: context.summary,
      outputSnapshot,
    };
  }

  /**
   * Create a degraded execution result when runtime is unavailable.
   * This provides a fallback path for graceful degradation.
   */
  protected createDegradedResult(
    context: RuntimeExecutionContext,
    reason: string,
  ): RuntimeExecutionResult {
    const outputSnapshot: RuntimeOutputSnapshot = {
      runtimeName: this.name,
      executor: context.executor,
      executionMode: context.executionMode,
      degraded: true,
      fallbackReason: reason,
    };

    return {
      outputSummary: `[Degraded] ${context.summary}`,
      outputSnapshot,
    };
  }
}
