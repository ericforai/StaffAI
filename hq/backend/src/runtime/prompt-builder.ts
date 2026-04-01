import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import type { AgentMemory } from '../shared/intent-types';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface KnowledgeEntryLike {
  task: string;
  agentId: string;
  resultSummary: string;
}

export interface PromptContext {
  assignment: string;
  knowledgeContext: string;
  l3MemoryContext?: string;
}

export type ParticipantFormatter = (
  participant: Pick<DiscussionParticipant, 'name' | 'response'>,
  index: number,
) => string;

export interface SynthesisOptions {
  participantFormatter?: ParticipantFormatter;
  sectionLines?: string[];
}

export interface PromptBuilder {
  buildExpertPrompt(context: PromptContext): string;
  buildSynthesisPrompt(topic: string, participants: readonly DiscussionParticipant[], options?: SynthesisOptions): string;
  buildKnowledgeContext(task: string, history: KnowledgeEntryLike[], getAgent: (agentId: string) => Agent | undefined): string;
  buildAgentL3MemoryContext(memory: AgentMemory | null): string;
  formatParticipantResponses(
    participants: readonly Pick<DiscussionParticipant, 'name' | 'response'>[],
    formatter?: ParticipantFormatter
  ): string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SYNTHESIS_SECTIONS = [
  '1. 共识',
  '2. 分歧',
  '3. 推荐行动方案',
  '4. 建议的下一步负责人',
] as const;

const DEFAULT_PARTICIPANT_FORMATTER: ParticipantFormatter = (participant, index) =>
  `## 专家 ${index + 1}: ${participant.name}\n${participant.response || '未返回结果'}`;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Builds a knowledge context string from historical knowledge entries.
 * Returns empty string if history is empty.
 */
export function buildKnowledgeContext(
  task: string,
  history: KnowledgeEntryLike[],
  getAgent: (agentId: string) => Agent | undefined,
): string {
  if (history.length === 0) {
    return '';
  }

  const header = '\n\n---\n### 相关历史经验参考：\n';
  const entries = history
    .map((entry, index) => {
      const expert = getAgent(entry.agentId);
      const expertName = expert?.frontmatter.name ?? entry.agentId;
      return `${index + 1}. 【任务】: ${entry.task}\n   【专家】: ${expertName}\n   【结果】: ${entry.resultSummary}`;
    })
    .join('\n');

  return header + entries;
}

/**
 * Builds an L3 memory context string for a specific agent.
 */
export function buildAgentL3MemoryContext(memory: AgentMemory | null): string {
  if (!memory) return '';

  let context = '\n\n---\n### 员工专属记忆 (L3 Memory)：\n';

  if (memory.experienceLog.length > 0) {
    context += '\n#### 历史经验日志：\n';
    context += memory.experienceLog
      .slice(-5) // Only last 5 entries
      .map((e) => `- 【${e.title}】: ${e.insight}`)
      .join('\n');
  }

  if (memory.behavioralHeuristics.length > 0) {
    context += '\n\n#### 行为准则 (用户纠正总结)：\n';
    context += memory.behavioralHeuristics
      .map((h) => `- 发现模式: ${h.pattern}\n  改进动作: ${h.correction}`)
      .join('\n');
  }

  return context;
}

/**
 * Combines an assignment string with knowledge and L3 memory context.
 */
export function buildExpertPrompt(
  assignment: string,
  knowledgeContext: string,
  l3MemoryContext: string = '',
): string {
  return `${assignment}${l3MemoryContext}${knowledgeContext}`;
}

/**
 * Formats participant responses using the provided or default formatter.
 */
export function formatParticipantResponses(
  participants: readonly Pick<DiscussionParticipant, 'name' | 'response'>[],
  formatter: ParticipantFormatter = DEFAULT_PARTICIPANT_FORMATTER,
): string {
  const formatted: string[] = [];
  for (let i = 0; i < participants.length; i++) {
    formatted.push(formatter(participants[i]!, i));
  }
  return formatted.join('\n\n');
}

/**
 * Builds a synthesis prompt for consolidating participant responses.
 */
export function buildSynthesisPrompt(
  topic: string,
  participants: readonly Pick<DiscussionParticipant, 'name' | 'response'>[],
  options: SynthesisOptions = {},
): string {
  const compiled = formatParticipantResponses(participants, options.participantFormatter);
  const sections = options.sectionLines ?? [...DEFAULT_SYNTHESIS_SECTIONS];

  const lines: string[] = [
    `讨论主题：${topic}`,
    '',
    '请综合以下专家意见，输出：',
    ...sections,
    '',
    compiled,
  ];

  return lines.join('\n');
}

// ============================================================================
// PromptBuilder Factory
// ============================================================================

/**
 * Creates a PromptBuilder instance with all prompt-building methods.
 */
export function createPromptBuilder(): PromptBuilder {
  return {
    buildExpertPrompt(context: PromptContext): string {
      return buildExpertPrompt(context.assignment, context.knowledgeContext, context.l3MemoryContext);
    },

    buildSynthesisPrompt(topic: string, participants: readonly DiscussionParticipant[], options?: SynthesisOptions): string {
      return buildSynthesisPrompt(topic, participants, options);
    },

    buildKnowledgeContext(
      task: string,
      history: KnowledgeEntryLike[],
      getAgent: (agentId: string) => Agent | undefined,
    ): string {
      return buildKnowledgeContext(task, history, getAgent);
    },

    buildAgentL3MemoryContext(memory: AgentMemory | null): string {
      return buildAgentL3MemoryContext(memory);
    },

    formatParticipantResponses(
      participants: readonly Pick<DiscussionParticipant, 'name' | 'response'>[],
      formatter?: ParticipantFormatter,
    ): string {
      return formatParticipantResponses(participants, formatter);
    },
  };
}
