import type { RequirementDraft } from '../shared/intent-types';

export interface BrainstormingResult {
  updatedDraft: RequirementDraft;
  isComplete: boolean;
}

/**
 * Enhanced Brainstorming Service (Simulated LLM)
 * In a real scenario, this would call an LLM with brainstorming skills.
 */
export class BrainstormingService {
  private questions = [
    "What is the primary goal of this feature?",
    "Who are the target users (e.g., developers, end-users, admins)?",
    "What are the core technical constraints or stack preferences?",
    "What should be the final deliverable (e.g., API, UI components, documentation)?",
    "Are there any specific risks or security concerns to consider?"
  ];

  async clarify(draft: RequirementDraft, message: string): Promise<BrainstormingResult> {
    const now = new Date().toISOString();
    
    // 1. Record user message
    draft.clarificationMessages.push({
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: message,
      timestamp: now,
    });
    
    draft.status = 'clarifying';
    
    // 2. Determine next question or completion
    const userMessageCount = draft.clarificationMessages.filter(m => m.role === 'user').length;
    console.log(`[Brainstorming] Draft ID: ${draft.id}, User Message Count: ${userMessageCount}`);
    
    // Simple logic: After 3-4 rounds, complete the brainstorming
    const isComplete = userMessageCount >= 4; // Increased threshold for testing
    console.log(`[Brainstorming] Is complete: ${isComplete}`);
    
    if (isComplete) {
      draft.status = 'design_ready';
      draft.designSummary = {
        goal: draft.rawInput,
        targetUser: this.extractInfo(draft, 'user') || 'End users',
        coreFlow: 'User input -> Processing -> Output',
        scope: 'Core functionality as described',
        outOfScope: 'Advanced optimizations and complex integrations',
        deliverables: 'Functional implementation with tests',
        constraints: 'Adhere to project coding standards',
        risks: 'Low to Medium (standard development)',
      };
    } else {
      // Pick the next question based on current round
      const nextQuestion = this.questions[userMessageCount % this.questions.length];
      draft.clarificationMessages.push({
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: nextQuestion,
        timestamp: now,
      });
    }
    
    draft.updatedAt = now;
    return { updatedDraft: draft, isComplete };
  }

  private extractInfo(draft: RequirementDraft, keyword: string): string | null {
    // Very naive extraction from message history
    const lastUserMsg = [...draft.clarificationMessages].reverse().find(m => m.role === 'user');
    return lastUserMsg ? lastUserMsg.content : null;
  }
}
