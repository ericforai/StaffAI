import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime-adapter';

export class CodexRuntimeAdapter implements RuntimeAdapter {
  name = 'local_codex_cli';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    return {
      outputSummary: context.summary,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'codex',
        simulated: true,
      },
    };
  }

  async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    return contexts.map((c) => ({
      outputSummary: c.summary,
      outputSnapshot: { runtimeName: this.name, executor: 'codex', simulated: true, mode: 'serial' },
    }));
  }

  async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    return contexts.map((c) => ({
      outputSummary: c.summary,
      outputSnapshot: { runtimeName: this.name, executor: 'codex', simulated: true, mode: 'parallel' },
    }));
  }
}
