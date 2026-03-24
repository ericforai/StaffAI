import type { Agent } from '../types';
import type { ExpertCandidate } from './expert-discovery';

export interface DiscussionParticipant extends ExpertCandidate {
  hiredForTask: boolean;
  assignment: string;
  response?: string;
  failed?: boolean;
  failureReason?: string;
}

interface DiscussionRosterDependencies {
  searchExperts: (topic: string, requestedCount: number) => ExpertCandidate[];
  getAgent: (id: string) => Agent | undefined;
}

function getFeatures(text: string): Map<string, number> {
  const features = new Map<string, number>();
  const words = text
    .toLowerCase()
    .split(/[\s,，.。!！?？\-_/():]+/)
    .filter((token) => token.length > 0);

  for (const word of words) {
    features.set(word, (features.get(word) || 0) + 1);
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/[\u4e00-\u9fa5]/.test(char)) {
      features.set(char, (features.get(char) || 0) + 1);
    }
  }

  return features;
}

function calculateSmartScore(agent: Agent, topic: string): number {
  const taskFeatures = getFeatures(topic);
  const nameFeatures = getFeatures(agent.frontmatter.name);
  const descFeatures = getFeatures(agent.frontmatter.description);
  const idFeatures = getFeatures(agent.id);

  let score = 0;
  taskFeatures.forEach((count, feature) => {
    if (nameFeatures.has(feature)) score += count * nameFeatures.get(feature)! * 10;
    if (idFeatures.has(feature)) score += count * idFeatures.get(feature)! * 8;
    if (descFeatures.has(feature)) score += count * descFeatures.get(feature)! * 2;
  });

  return score;
}

function buildExpertAssignment(topic: string, agent: Agent, allAgents: Agent[]): string {
  const peers = allAgents.map((entry) => `- ${entry.frontmatter.name}: ${entry.frontmatter.description}`).join('\n');

  return [
    `主题：${topic}`,
    '',
    `你当前扮演的专家：${agent.frontmatter.name}`,
    `你的职责：${agent.frontmatter.description}`,
    '',
    '当前讨论阵容：',
    peers,
    '',
    '请独立完成以下任务：',
    '1. 从你的专业角度给出核心判断。',
    '2. 指出你最关注的风险或约束。',
    '3. 提出 2-4 条可执行建议。',
    '4. 说明你希望其他专家补充回答的一个问题。',
    '',
    '请使用清晰的小标题输出，重点保持专业、具体、可执行。',
  ].join('\n');
}

export function createDiscussionRosterService(dependencies: DiscussionRosterDependencies) {
  return {
    prepareDiscussion(topic: string, requestedCount = 3, agentIds?: string[]): DiscussionParticipant[] {
      const selectedIds = Array.isArray(agentIds) && agentIds.length > 0 ? agentIds : null;
      const candidates = selectedIds
        ? selectedIds
            .map((agentId) => {
              const agent = dependencies.getAgent(agentId);
              if (!agent) {
                return null;
              }
              return {
                id: agent.id,
                name: agent.frontmatter.name,
                description: agent.frontmatter.description,
                department: agent.department,
                score: calculateSmartScore(agent, topic),
                isActive: false,
                agent,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        : dependencies
            .searchExperts(topic, requestedCount)
            .map((candidate) => ({
              ...candidate,
              agent: dependencies.getAgent(candidate.id),
            }))
            .filter((entry): entry is ExpertCandidate & { agent: Agent } => Boolean(entry.agent));

      const allAgents = candidates.map((entry) => entry.agent);
      return candidates.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        department: entry.department,
        score: entry.score,
        isActive: entry.isActive,
        hiredForTask: !entry.isActive,
        assignment: buildExpertAssignment(topic, entry.agent, allAgents),
      }));
    },
  };
}
