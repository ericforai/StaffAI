import type { RequirementDraft } from '../shared/intent-types';

const WORKSHOP_URL = process.env.WORKSHOP_URL || 'http://localhost:8000';

export interface BrainstormingResult {
  updatedDraft: RequirementDraft;
  isComplete: boolean;
}

const BRAINSTORMING_PROMPT = `You are an expert Product Manager conducting a requirement clarification session with a user.

Your goal is to fully understand what they want to build through targeted conversation.
Ask ONE focused question at a time. Be specific and build on their previous answers.
After 4-5 exchanges, automatically provide a Design Summary.

## Important Rules:
- Keep questions short and specific (one sentence)
- Show that you're listening by referencing their previous answers
- When you have enough information, say "Based on our discussion, here's the design summary:" and provide the Design Summary

## Design Summary format (respond in this exact JSON structure when ready):
\`\`\`json
{
  "goal": "What to build - specific and concise",
  "targetUser": "Who will use this - be specific about their role",
  "coreFlow": "Main user flow in 1-2 sentences",
  "scope": "What is included (3-5 bullet points)",
  "outOfScope": "What is NOT included (2-3 bullet points)",
  "deliverables": "What will be delivered (3-4 items)",
  "constraints": "Technical or business constraints (2-3 items)",
  "risks": "Potential risks or concerns (2-3 items)"
}
\`\`\`

Start by acknowledging their request and asking your first question.`;

/**
 * Workshop LLM Client for Brainstorming
 * Calls the Workshop's DeerFlow streaming endpoint for real LLM-powered clarification
 */
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
        model_name: 'glm-4-plus'
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

    // Check if we've seen the design summary marker
    let designSummaryText = '';
    let inDesignSummary = false;
    let isComplete = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (!data.trim()) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === 'message' || event.type === 'ai') {
                const content = typeof event === 'string' ? event : (event.content || '');

                // Check if this is a design summary response
                if (content.includes('"goal"') || content.includes('```json')) {
                  inDesignSummary = true;
                }

                if (inDesignSummary) {
                  designSummaryText += content;
                }

                // Check for completion markers
                if (content.includes('Design Summary') || content.includes('```json')) {
                  if (!isComplete) {
                    isComplete = true;
                    // Try to parse design summary from the accumulated text
                    const designSummary = this.parseDesignSummary(designSummaryText || content);
                    yield {
                      type: 'done',
                      content: '',
                      done: true,
                      isComplete: true,
                      designSummary
                    };
                  }
                } else if (!inDesignSummary) {
                  yield { type: 'message', content };
                }
              } else if (event.type === 'done') {
                // End of stream
                if (!isComplete) {
                  isComplete = true;
                  yield {
                    type: 'done',
                    content: '',
                    done: true,
                    isComplete: false
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
        const parsed = JSON.parse(jsonStr.trim());

        // Validate it has required fields
        if (parsed.goal && parsed.targetUser) {
          return {
            goal: parsed.goal,
            targetUser: parsed.targetUser,
            coreFlow: parsed.coreFlow || 'To be determined',
            scope: parsed.scope || 'Core functionality',
            outOfScope: parsed.outOfScope || 'To be determined',
            deliverables: parsed.deliverables || 'Full implementation',
            constraints: parsed.constraints || 'Standard constraints apply',
            risks: parsed.risks || 'Low risk',
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
