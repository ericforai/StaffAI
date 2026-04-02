import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import { buildExpertPrompt, buildKnowledgeContext, buildSynthesisPrompt, buildAgentL3MemoryContext, KnowledgeEntryLike } from './prompt-builder';
import type { ExecutorName } from './discussion-types';
import type { AgentMemory } from '../shared/intent-types';

export const DISCUSSION_HOST_SYSTEM_PROMPT =
  '你是 The Agency HQ 的主持人。请综合多位专家观点，形成统一结论，不要虚构未出现的信息。';

interface DiscussionExecutionFacadeDependencies {
  runtime: {
    generateText: (systemPrompt: string, userPrompt: string) => Promise<{ text: string; executor: ExecutorName }>;
  };
  searchKnowledge: (task: string) => Promise<KnowledgeEntryLike[]>;
  getAgent: (id: string) => Agent | undefined;
  getAgentMemoryByAgentId: (agentId: string) => Promise<AgentMemory | null>;
}

export function createDiscussionExecutionFacade(dependencies: DiscussionExecutionFacadeDependencies) {
  return {
    async generateExpertReply(agent: Agent, assignment: string): Promise<{ text: string; executor: ExecutorName }> {
      const knowledge = await dependencies.searchKnowledge(assignment);
      const memory = await dependencies.getAgentMemoryByAgentId(agent.id);
      
      const knowledgeContext = buildKnowledgeContext(assignment, knowledge, dependencies.getAgent);
      const l3MemoryContext = buildAgentL3MemoryContext(memory);

      const prompt = buildExpertPrompt(
        assignment,
        knowledgeContext,
        l3MemoryContext
      );
      return dependencies.runtime.generateText(agent.systemPrompt, prompt);
    },
    async synthesizeDiscussion(
      topic: string,
      participants: DiscussionParticipant[],
    ): Promise<{ text: string; executor: ExecutorName }> {
      const prompt = buildSynthesisPrompt(topic, participants);
      return dependencies.runtime.generateText(DISCUSSION_HOST_SYSTEM_PROMPT, prompt);
    },
  };
}
