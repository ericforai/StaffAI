import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime-adapter';

export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  name = 'local_claude_cli';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    return {
      outputSummary: context.summary,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'claude',
        simulated: true,
        executionMode: context.executionMode,
      },
    };
  }

  async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    return contexts.map((c) => ({
      outputSummary: c.summary,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'claude',
        simulated: true,
        executionMode: c.executionMode,
      },
    }));
  }

  async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    return contexts.map((c) => ({
      outputSummary: c.summary,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'claude',
        simulated: true,
        executionMode: c.executionMode,
      },
    }));
  }
}
