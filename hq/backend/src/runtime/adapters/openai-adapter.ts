import type { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult, RuntimeOutputSnapshot } from '../runtime-adapter';

interface OpenAIChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface OpenAIChatChoice {
  message?: {
    content?: string;
  };
}

interface OpenAIChatResponse {
  choices?: OpenAIChatChoice[];
  model?: string;
  usage?: {
    total_tokens?: number;
  };
}

export class OpenAIRuntimeAdapter implements RuntimeAdapter {
  name = 'openai_api';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private getConfig() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    return { apiKey, baseUrl, model };
  }

  private async execute(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const startedAt = Date.now();
    const { apiKey, baseUrl, model } = this.getConfig();
    const timeoutMs = Number.isFinite(context.timeoutMs) && context.timeoutMs > 0 ? context.timeoutMs : 30_000;

    if (!apiKey) {
      return this.createDegradedResult(context, 'OPENAI_API_KEY is not configured');
    }

    const taskDescription = context.task.description || context.task.title;
    const userPrompt = [taskDescription, '', 'Context:', context.summary].join('\n');
    const messages: OpenAIChatMessage[] = [
      {
        role: 'system',
        content: 'You are an execution agent. Return only the final useful result for the task.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return this.createDegradedResult(context, `OpenAI request failed (${response.status}): ${detail}`);
      }

      const payload = (await response.json()) as OpenAIChatResponse;
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return this.createDegradedResult(context, 'OpenAI returned empty content');
      }

      const outputSnapshot: RuntimeOutputSnapshot = {
        runtimeName: this.name,
        executor: 'openai',
        executionMode: context.executionMode,
        responseTimeMs: Date.now() - startedAt,
        degraded: false,
        modelVersion: payload.model || model,
        tokensUsed: payload.usage?.total_tokens,
      };

      return {
        outputSummary: text,
        outputSnapshot,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.createDegradedResult(context, reason);
    }
  }

  private createDegradedResult(context: RuntimeExecutionContext, reason: string): RuntimeExecutionResult {
    return {
      outputSummary: `Error executing openai: ${reason}`,
      outputSnapshot: {
        runtimeName: this.name,
        executor: 'openai',
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
