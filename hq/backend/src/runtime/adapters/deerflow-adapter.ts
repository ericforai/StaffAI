import { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime-adapter';

export class DeerFlowRuntimeAdapter implements RuntimeAdapter {
  name = 'python_deerflow_workshop';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private readonly WORKSHOP_URL = process.env.WORKSHOP_URL || 'http://localhost:8000';

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    try {
      const response = await fetch(`${this.WORKSHOP_URL}/api/v1/tasks/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: context.task.id,
          action: context.task.title || 'Unknown Task',
          payload: context.inputSnapshot || {}
        }),
      });

      if (!response.ok) {
        throw new Error(`Workshop responded with status: ${response.status}`);
      }

      const data = await response.json();

      return {
        outputSummary: data.result || 'Execution completed by DeerFlow Workshop',
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'deerflow',
          executionMode: context.executionMode,
          additionalData: data
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`DeerFlow execution failed: ${errorMessage}`);
    }
  }

  async runSerial(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    const results: RuntimeExecutionResult[] = [];
    for (const ctx of contexts) {
      results.push(await this.run(ctx));
    }
    return results;
  }

  async runParallel(contexts: RuntimeExecutionContext[]): Promise<RuntimeExecutionResult[]> {
    return Promise.all(contexts.map(ctx => this.run(ctx)));
  }
}
