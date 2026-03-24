import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import { buildExpertPrompt, buildKnowledgeContext, buildSynthesisPrompt, KnowledgeEntryLike } from './expert-runner';
import type { ExecutorName } from './discussion-types';

export const DISCUSSION_HOST_SYSTEM_PROMPT =
  '你是 The Agency HQ 的主持人。请综合多位专家观点，形成统一结论，不要虚构未出现的信息。';

interface DiscussionExecutionFacadeDependencies {
  runtime: {
    generateText: (systemPrompt: string, userPrompt: string) => Promise<{ text: string; executor: ExecutorName }>;
  };
  searchKnowledge: (task: string) => KnowledgeEntryLike[];
  getAgent: (id: string) => Agent | undefined;
}

export function createDiscussionExecutionFacade(dependencies: DiscussionExecutionFacadeDependencies) {
  return {
    async generateExpertReply(agent: Agent, assignment: string): Promise<{ text: string; executor: ExecutorName }> {
      const prompt = buildExpertPrompt(
        assignment,
        buildKnowledgeContext(assignment, dependencies.searchKnowledge(assignment), dependencies.getAgent),
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
