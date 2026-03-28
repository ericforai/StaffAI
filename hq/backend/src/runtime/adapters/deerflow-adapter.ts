import { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime-adapter';

export class DeerFlowRuntimeAdapter implements RuntimeAdapter {
  name = 'python_deerflow_workshop';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private readonly WORKSHOP_URL = process.env.WORKSHOP_URL || 'http://localhost:8000';

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    try {
      const controller = new AbortController();
      // 对于流式任务，我们可能需要更长的超时或依赖内部心跳
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2min for streaming

      const response = await fetch(`${this.WORKSHOP_URL}/api/v1/tasks/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: context.task.id,
          action: context.task.title || 'Unknown Task',
          agent_role: context.task.recommendedAgentRole,
          description: context.task.description,
          memory_context: context.memoryContextExcerpt,
          payload: context.inputSnapshot || {}
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`Workshop responded with status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        clearTimeout(timeoutId);
        throw new Error('No response body available from Workshop');
      }

      const decoder = new TextDecoder();
      let outputSummary = '';
      let lastData: any = null;

      // 解析 SSE 事件流的简单逻辑
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;
              
              const parsed = JSON.parse(dataStr);
              lastData = parsed.payload;

              // 触发实时事件回调
              if (context.onEvent) {
                context.onEvent({
                  type: parsed.event || 'message',
                  data: parsed.payload
                });
              }

              // 这里的逻辑可以根据 DeerFlow 的事件类型进行扩展
              // 目前简单累积输出摘要
              if (parsed.payload?.content) {
                outputSummary += parsed.payload.content;
              }
              
              // TODO: 这里将来可以调用 context.onEvent 之类的回调发送给前端 WebSocket
              // console.log(`[DeerFlow Stream] Event received:`, parsed);
            } catch (e) {
              // 忽略解析失败的行
            }
          }
        }
      }

      clearTimeout(timeoutId);

      return {
        outputSummary: outputSummary || 'Execution completed by DeerFlow Workshop',
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'deerflow',
          executionMode: context.executionMode,
          additionalData: lastData
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`DeerFlow streaming failed: ${errorMessage}`);
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
