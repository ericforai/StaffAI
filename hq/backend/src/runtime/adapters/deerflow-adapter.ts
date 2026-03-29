import { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime-adapter';
import {
  createTaskEnvelopeV2,
  serializeEnvelope,
  type TaskEnvelopeV2,
} from '../../shared/task-envelope-v2';

export class DeerFlowRuntimeAdapter implements RuntimeAdapter {
  name = 'python_deerflow_workshop';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private readonly WORKSHOP_URL = process.env.WORKSHOP_URL || 'http://127.0.0.1:8000';

  private buildEnvelopeV2(context: RuntimeExecutionContext, enhancedDescription: string): TaskEnvelopeV2 {
    const task = context.task;
    return createTaskEnvelopeV2({
      taskMetadata: {
        taskId: task.id,
        title: task.title,
        description: enhancedDescription,
        taskType: task.taskType,
        priority: task.priority,
        executionMode: context.executionMode,
        requestedBy: task.requestedBy,
        requestedAt: task.requestedAt,
      },
      routing: {
        assigneeId: task.assigneeId,
        assigneeName: task.assigneeName,
        recommendedAgentRole: task.recommendedAgentRole,
        candidateAgentRoles: task.candidateAgentRoles,
        routeReason: task.routeReason,
      },
      approvalContext: {
        approvalRequired: task.approvalRequired,
        riskLevel: task.riskLevel,
      },
      memoryContext: context.memoryContextExcerpt
        ? { profileExcerpt: context.memoryContextExcerpt }
        : {},
      budgetControl: {
        timeoutMs: context.timeoutMs,
        maxRetries: context.maxRetries,
      },
      checkpoint: {},
      runtimeControl: {
        executor: 'deerflow',
        runtimeName: this.name,
        sessionCapabilities: { sampling: false },
      },
    });
  }

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const urlMatch = context.task.description.match(/https?:\/\/[^\s]+/);
      const enhancedDescription = `
${context.task.description}

---
[SYSTEM OVERRIDE - CRITICAL RULES]
1. 如果任务涉及特定网址（如 ${urlMatch?.[0] || '目标网址'}），你必须【优先】使用 read_url 工具直接访问该网址。
2. 只有在 read_url 明确返回错误（如 404 或连接失败）时，才允许使用 web_search 进行辅助搜索。
3. 严禁在未尝试 read_url 的情况下进行搜索引擎猜测或域名猜测。
4. 所有的分析报告和结论必须使用【中文】。
5. 最终产出应具有清晰的 Markdown 结构（使用 ## 二级标题）。
---
`.trim();

      const envelope = this.buildEnvelopeV2(context, enhancedDescription);

      const response = await fetch(`${this.WORKSHOP_URL}/api/v1/tasks/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serializeEnvelope(envelope)),
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
      let lastData: unknown = null;
      let currentEventType = 'message';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');

        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              const parsed = JSON.parse(dataStr);
              lastData = (parsed as { payload?: unknown }).payload !== undefined
                ? (parsed as { payload: unknown }).payload
                : parsed;

              if (context.onEvent) {
                context.onEvent({
                  type: currentEventType,
                  data: lastData as Record<string, unknown>
                });
              }

              let currentCandidate = '';
              let currentWeight = 0;

              if (currentEventType === 'values' && (lastData as { messages?: unknown[] }).messages) {
                const messages = (lastData as { messages: Array<{ type: string; content?: string; tool_calls?: unknown }> }).messages;
                const aiMsgs = messages.filter((m) => m.type === 'ai' && m.content && !m.tool_calls);
                if (aiMsgs.length > 0) {
                  currentCandidate = aiMsgs[aiMsgs.length - 1].content || '';
                  currentWeight = 10;
                }
              } else if ((lastData as { content?: string }).content && typeof (lastData as { content: string }).content === 'string') {
                currentCandidate = (lastData as { content: string }).content;
                currentWeight = 5;
              }

              if (currentCandidate &&
                  !currentCandidate.includes('{"query":') &&
                  !currentCandidate.includes('我正在搜索') &&
                  !currentCandidate.includes('403 Forbidden')) {

                const existingSummaryLength = outputSummary.length;
                if (currentWeight >= 10 || currentCandidate.length > existingSummaryLength) {
                  outputSummary = currentCandidate;
                }
              }

              currentEventType = 'message';
            } catch {
              // Ignore malformed SSE fragments
            }
          }
        }
      }

      clearTimeout(timeoutId);

      const finalSummary = outputSummary
        .replace(/\{"query":.*?\}/g, '')
        .replace(/#+ Untitled\n+/g, '')
        .trim();

      return {
        outputSummary: finalSummary || 'Execution completed by DeerFlow Workshop',
        outputSnapshot: {
          runtimeName: this.name,
          executor: 'deerflow',
          executionMode: context.executionMode,
          protocolVersion: '2.0',
          routing: {
            recommendedAgentRole: context.task.recommendedAgentRole,
            assigneeId: context.task.assigneeId,
          },
          budgetControl: {
            timeoutMs: context.timeoutMs,
            maxRetries: context.maxRetries,
          },
          additionalData: lastData as Record<string, unknown> | undefined
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
