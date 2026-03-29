import { RuntimeAdapter, RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime-adapter';

export class DeerFlowRuntimeAdapter implements RuntimeAdapter {
  name = 'python_deerflow_workshop';
  supports: Array<'single' | 'serial' | 'parallel' | 'advanced_discussion'> = ['single', 'serial', 'parallel'];

  private readonly WORKSHOP_URL = process.env.WORKSHOP_URL || 'http://127.0.0.1:8000';

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 增加到 5min，因为多步搜索较慢

      // 注入强制行为指令
      const enhancedDescription = `
${context.task.description}

---
[SYSTEM OVERRIDE - CRITICAL RULES]
1. 如果任务涉及特定网址（如 ${context.task.description.match(/https?:\/\/[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+/g)?.[0] || '目标网址'}），你必须【优先】使用 read_url 工具直接访问该网址。
2. 只有在 read_url 明确返回错误（如 404 或连接失败）时，才允许使用 web_search 进行辅助搜索。
3. 严禁在未尝试 read_url 的情况下进行搜索引擎猜测或域名猜测。
4. 所有的分析报告和结论必须使用【中文】。
5. 最终产出应具有清晰的 Markdown 结构（使用 ## 二级标题）。
---
`.trim();

      const response = await fetch(`${this.WORKSHOP_URL}/api/v1/tasks/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: context.task.id,
          action: context.task.title || 'Unknown Task',
          agent_role: context.task.recommendedAgentRole,
          // 注入负责人的身份角色（从任务路由信息提取）
          identity_context: context.task.recommendedAgentRole
            ? `You are acting as: ${context.task.recommendedAgentRole}. ${context.task.description}`
            : context.task.description,
          description: enhancedDescription,
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
      let currentEventType = 'message';
      let buffer = ''; // 增加缓冲区处理碎片

      // 解析 SSE 事件流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        
        // 保留最后一个不完整的行
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              const parsed = JSON.parse(dataStr);
              lastData = parsed.payload !== undefined ? parsed.payload : parsed;

              // 触发实时事件流（Dashboard 直播）
              if (context.onEvent) {
                context.onEvent({
                  type: currentEventType,
                  data: lastData
                });
              }

              // 【智能权重捕获算法】
              let currentCandidate = '';
              let currentWeight = 0;

              // 策略 1: 来源于 values 事件的全量 AI 消息 (最高权重)
              if (currentEventType === 'values' && lastData?.messages) {
                const aiMsgs = lastData.messages.filter((m: any) => m.type === 'ai' && m.content && !m.tool_calls);
                if (aiMsgs.length > 0) {
                  currentCandidate = aiMsgs[aiMsgs.length - 1].content;
                  currentWeight = 10;
                }
              } 
              // 策略 2: 来源于独立 message 的长文本 (中等权重)
              else if (lastData?.content && typeof lastData.content === 'string') {
                currentCandidate = lastData.content;
                currentWeight = 5;
              }

              // 过滤噪音并执行更新决策
              if (currentCandidate && 
                  !currentCandidate.includes('{"query":') && 
                  !currentCandidate.includes('我正在搜索') &&
                  !currentCandidate.includes('403 Forbidden')) {
                
                // 只有当新内容的权重更高，或者长度显著增加时，才进行覆盖
                const existingSummaryLength = outputSummary.length;
                if (currentWeight >= 10 || currentCandidate.length > existingSummaryLength) {
                  outputSummary = currentCandidate;
                }
              }

              currentEventType = 'message';
            } catch (e) {
              // 忽略碎片
            }
          }
        }
      }


      clearTimeout(timeoutId);

      // 最后一次清洗：移除摘要中可能存在的原始 JSON 碎片
      const finalSummary = outputSummary
        .replace(/\{"query":.*?\}/g, '') // 移除搜索查询 JSON
        .replace(/#+ Untitled\n+/g, '')  // 移除重复标题
        .trim();

      return {
        outputSummary: finalSummary || 'Execution completed by DeerFlow Workshop',
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
