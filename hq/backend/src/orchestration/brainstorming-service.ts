import type { RequirementDraft } from '../shared/intent-types';

const WORKSHOP_URL = process.env.WORKSHOP_URL || 'http://localhost:8000';

export interface BrainstormingResult {
  updatedDraft: RequirementDraft;
  isComplete: boolean;
}

const BRAINSTORMING_PROMPT = `你是一位资深产品经理，正在与用户进行需求澄清对话。

你的目标是通过有针对性的对话完全理解用户想要构建的内容。
每次只问一个聚焦的问题。要具体，并根据用户之前的回答进行追问。
经过 4-5 轮对话后，自动提供设计方案摘要。

## 重要规则：
- 问题要简短具体（一句话）
- 通过引用用户之前的回答来展示你在倾听
- 当收集到足够信息时，说"基于我们的讨论，以下是设计方案摘要："并提供设计摘要

## 设计摘要格式（准备好时用这个确切的 JSON 结构回复）：
\`\`\`json
{
  "goal": "要构建的内容 - 具体且简洁",
  "targetUser": "谁将使用这个 - 具体说明角色",
  "coreFlow": "主要用户流程（1-2 句话）",
  "scope": "包含的内容（3-5 条）",
  "outOfScope": "不包含的内容（2-3 条）",
  "deliverables": "将交付的内容（3-4 项）",
  "constraints": "技术或业务约束（2-3 条）",
  "risks": "潜在风险或问题（2-3 条）"
}
\`\`\`

首先确认用户的请求，然后提出你的第一个问题。`;

/**
 * Workshop LLM Client for Brainstorming
 * Calls the Workshop's DeerFlow streaming endpoint for real LLM-powered clarification
 */
/** 与系统提示一致：模型可能输出中文开场 + ```json，不能把 JSON 当普通气泡流式展示 */
function looksLikeDesignSummaryStream(content: string): boolean {
  return (
    /```\s*json/i.test(content) ||
    /设计方案摘要/.test(content) ||
    /基于我们的讨论/.test(content) ||
    /Design\s+Summary/i.test(content)
  );
}

export class WorkshopLLMClient {
  private workshopUrl: string;

  constructor(workshopUrl: string = WORKSHOP_URL) {
    this.workshopUrl = workshopUrl;
  }

  /**
   * Stream clarification response from Workshop LLM
   * Returns an AsyncIterable that yields SSE-formatted chunks
   */
  async *streamClarification(
    draft: RequirementDraft,
    userMessage: string
  ): AsyncGenerator<{ type: string; content: string; done?: boolean; isComplete?: boolean; designSummary?: RequirementDraft['designSummary'] }, void, unknown> {
    // Build conversation history for context
    const messages = this.buildMessages(draft, userMessage);
    const fullPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    // Use direct chat endpoint to bypass ClarificationMiddleware
    const response = await fetch(`${this.workshopUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: fullPrompt,
        system_prompt: BRAINSTORMING_PROMPT,
        model_name: 'minimax-m2.7'
      }),
    });

    if (!response.ok) {
      throw new Error(`Workshop request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from Workshop');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let designSummaryText = '';
    let inDesignSummary = false;
    /** 已发出终端 `done`（含 isComplete / designSummary），避免重复 */
    let terminalDoneSent = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Split on \n and remove \r from each line (SSE uses CRLF)
        const lines = buffer.split('\n').map(l => l.replace(/\r$/, ''));
        buffer = lines.pop() || '';

        let eventType = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (!data.trim()) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === 'message' || event.type === 'ai') {
                const content = typeof event === 'string' ? event : (event.content || '');

                if (inDesignSummary || looksLikeDesignSummaryStream(content)) {
                  inDesignSummary = true;
                  designSummaryText += content;
                  const parsed = this.parseDesignSummary(designSummaryText);
                  if (parsed && !terminalDoneSent) {
                    terminalDoneSent = true;
                    yield {
                      type: 'done',
                      content: '',
                      done: true,
                      isComplete: true,
                      designSummary: parsed,
                    };
                  }
                } else {
                  yield { type: 'message', content };
                }
              } else if (event.type === 'done' || event.type === 'end') {
                if (terminalDoneSent) {
                  break;
                }
                if (inDesignSummary && designSummaryText) {
                  const parsed = this.parseDesignSummary(designSummaryText);
                  terminalDoneSent = true;
                  yield {
                    type: 'done',
                    content: '',
                    done: true,
                    isComplete: !!parsed,
                    designSummary: parsed,
                  };
                } else {
                  terminalDoneSent = true;
                  yield {
                    type: 'done',
                    content: '',
                    done: true,
                    isComplete: false,
                  };
                }
              } else if (event.type === 'error') {
                throw new Error(event.error || 'Stream error');
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      if (!terminalDoneSent) {
        if (inDesignSummary && designSummaryText) {
          const parsed = this.parseDesignSummary(designSummaryText);
          terminalDoneSent = true;
          yield {
            type: 'done',
            content: '',
            done: true,
            isComplete: !!parsed,
            designSummary: parsed,
          };
        } else {
          terminalDoneSent = true;
          yield {
            type: 'done',
            content: '',
            done: true,
            isComplete: false,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Non-streaming clarification for backward compatibility
   */
  async clarify(draft: RequirementDraft, message: string): Promise<BrainstormingResult> {
    const now = new Date().toISOString();

    // Record user message
    draft.clarificationMessages.push({
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: message,
      timestamp: now,
    });

    draft.status = 'clarifying';
    draft.updatedAt = now;

    // Collect full response from streaming
    let fullResponse = '';
    let designSummary: RequirementDraft['designSummary'] | undefined;

    try {
      for await (const event of this.streamClarification(draft, message)) {
        if (event.type === 'done' && event.done) {
          designSummary = event.designSummary;
        } else if (event.content) {
          fullResponse += event.content;
        }
      }
    } catch (err) {
      console.error('[Brainstorming] Workshop call failed, using fallback:', err);
      // Fallback to mock if Workshop is unavailable
      return this.mockClarify(draft, message);
    }

    if (designSummary) {
      draft.status = 'design_ready';
      draft.designSummary = designSummary;
      draft.confidenceScore = 0.9;
    } else if (fullResponse) {
      // Add the LLM response as an assistant message
      draft.clarificationMessages.push({
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: fullResponse.trim(),
        timestamp: new Date().toISOString(),
      });

      // Estimate confidence based on exchange count
      const userMsgCount = draft.clarificationMessages.filter(m => m.role === 'user').length;
      draft.confidenceScore = Math.min(0.4 + (userMsgCount * 0.15), 0.85);
    }

    return {
      updatedDraft: draft,
      isComplete: !!designSummary
    };
  }

  private buildMessages(draft: RequirementDraft, newUserMessage: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history
    for (const msg of draft.clarificationMessages) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }

    // Add the new user message
    messages.push({ role: 'user', content: newUserMessage });

    return messages;
  }

  private parseDesignSummary(text: string): RequirementDraft['designSummary'] | undefined {
    try {
      // Try to find JSON in the text
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                        text.match(/\{[\s\S]*?"goal"[\s\S]*?\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr.trim()) as Record<string, unknown>;

        const asText = (v: unknown, fallback: string): string => {
          if (v == null || v === '') return fallback;
          if (typeof v === 'string') return v;
          if (Array.isArray(v)) return v.map((x) => String(x)).join('；');
          return String(v);
        };

        // Validate it has required fields
        if (parsed.goal && parsed.targetUser) {
          return {
            goal: asText(parsed.goal, ''),
            targetUser: asText(parsed.targetUser, ''),
            coreFlow: asText(parsed.coreFlow, 'To be determined'),
            scope: asText(parsed.scope, 'Core functionality'),
            outOfScope: asText(parsed.outOfScope, 'To be determined'),
            deliverables: asText(parsed.deliverables, 'Full implementation'),
            constraints: asText(parsed.constraints, 'Standard constraints apply'),
            risks: asText(parsed.risks, 'Low risk'),
          };
        }
      }
    } catch {
      // Parsing failed, will return undefined
    }
    return undefined;
  }

  /**
   * Mock clarification fallback when Workshop is unavailable
   */
  private mockClarify(draft: RequirementDraft, message: string): BrainstormingResult {
    const now = new Date().toISOString();
    const userMessageCount = draft.clarificationMessages.filter(m => m.role === 'user').length;
    const isComplete = userMessageCount >= 4;

    if (isComplete) {
      draft.status = 'design_ready';
      draft.designSummary = {
        goal: draft.rawInput,
        targetUser: 'End users',
        coreFlow: 'User input -> Processing -> Output',
        scope: 'Core functionality as described',
        outOfScope: 'Advanced optimizations',
        deliverables: 'Functional implementation with tests',
        constraints: 'Adhere to project coding standards',
        risks: 'Low to Medium',
      };
      draft.confidenceScore = 0.85;
    } else {
      const questions = [
        'What is the primary goal of this feature?',
        'Who are the target users?',
        'What are the technical constraints?',
        'What should be the final deliverable?',
        'Are there any security concerns?'
      ];
      const nextQuestion = questions[userMessageCount % questions.length];

      draft.clarificationMessages.push({
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: nextQuestion,
        timestamp: now,
      });
      draft.confidenceScore = 0.4 + (userMessageCount * 0.15);
    }

    draft.updatedAt = now;
    return { updatedDraft: draft, isComplete };
  }
}

/**
 * Legacy BrainstormingService - now delegates to WorkshopLLMClient
 */
export class BrainstormingService {
  private llmClient: WorkshopLLMClient;

  constructor() {
    this.llmClient = new WorkshopLLMClient();
  }

  async clarify(draft: RequirementDraft, message: string): Promise<BrainstormingResult> {
    return this.llmClient.clarify(draft, message);
  }

  /**
   * Get the streaming client for SSE support
   */
  getStreamingClient(): WorkshopLLMClient {
    return this.llmClient;
  }
}
