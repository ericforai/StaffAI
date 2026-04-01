import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { RequirementDraft } from '../shared/intent-types';
import type { OKRGap } from './inspector-service';

export class ProactiveProposalService {
  constructor(private readonly store: Store) {}

  /**
   * Generates a proactive RequirementDraft from an identified OKR gap.
   */
  public async propose(gap: OKRGap, agentId: string): Promise<RequirementDraft> {
    const now = new Date().toISOString();
    const draft: RequirementDraft = {
      id: `intent_proactive_${randomUUID()}`,
      rawInput: `[Autonomous Proposal from ${agentId}] Based on OKR "${gap.objective}", the Key Result "${gap.description}" is behind target (${gap.currentValueValue}${gap.unit} vs ${gap.targetValue}${gap.unit}). I recommend initiating a task to address this gap.`,
      status: 'intake',
      clarificationMessages: [
        {
          id: randomUUID(),
          role: 'assistant',
          content: `I have identified a performance gap in our OKRs and am proactively proposing a remedial task.`,
          timestamp: now,
        }
      ],
      designSummary: null,
      implementationPlan: null,
      suggestedAutonomyLevel: 'L2',
      suggestedScenario: 'feature-delivery',
      originatingAgentId: agentId,
      confidenceScore: 1.0,
      createdTaskId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveRequirementDraft(draft);
    return draft;
  }
}
