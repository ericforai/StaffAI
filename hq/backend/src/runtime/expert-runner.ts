import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';

export interface KnowledgeEntryLike {
  task: string;
  agentId: string;
  resultSummary: string;
}

export function buildKnowledgeContext(
  task: string,
  history: KnowledgeEntryLike[],
  getAgent: (agentId: string) => Agent | undefined,
): string {
  if (history.length === 0) {
    return '';
  }

  return (
    '\n\n---\n### 相关历史经验参考：\n' +
    history
      .map((entry, index) => {
        const expert = getAgent(entry.agentId);
        const expertName = expert?.frontmatter.name || entry.agentId;
        return `${index + 1}. 【任务】: ${entry.task}\n   【专家】: ${expertName}\n   【结果】: ${entry.resultSummary}`;
      })
      .join('\n')
  );
}

export function buildExpertPrompt(assignment: string, knowledgeContext: string): string {
  return `${assignment}${knowledgeContext}`;
}

export type ParticipantFormatter = (
  participant: Pick<DiscussionParticipant, 'name' | 'response'>,
  index: number,
) => string;

const defaultParticipantFormatter: ParticipantFormatter = (participant, index) =>
  `## 专家 ${index + 1}: ${participant.name}\n${participant.response || '未返回结果'}`;

export function formatParticipantResponses(
  participants: Array<Pick<DiscussionParticipant, 'name' | 'response'>>,
  formatter: ParticipantFormatter = defaultParticipantFormatter,
): string {
  return participants.map((participant, index) => formatter(participant, index)).join('\n\n');
}

const defaultSynthesisSections = [
  '1. 共识',
  '2. 分歧',
  '3. 推荐行动方案',
  '4. 建议的下一步负责人',
];

export interface SynthesisOptions {
  participantFormatter?: ParticipantFormatter;
  sectionLines?: string[];
}

export function buildSynthesisPrompt(
  topic: string,
  participants: Array<Pick<DiscussionParticipant, 'name' | 'response'>>,
  options: SynthesisOptions = {},
): string {
  const compiled = formatParticipantResponses(participants, options.participantFormatter);
  const sections = options.sectionLines ?? defaultSynthesisSections;

  return [
    `讨论主题：${topic}`,
    '',
    '请综合以下专家意见，输出：',
    ...sections,
    '',
    compiled,
  ].join('\n');
}
