import type { ExpertCandidate } from './expert-discovery';

export function selectBestExpert(candidates: ExpertCandidate[]): ExpertCandidate | null {
  return (
    [...candidates].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })[0] || null
  );
}

export function buildConsultAssignment(input: {
  task: string;
  expertName: string;
  expertDescription: string;
}) {
  return [
    `任务：${input.task}`,
    '',
    `你当前扮演的专家：${input.expertName}`,
    `你的职责：${input.expertDescription}`,
    '',
    '请直接给出最重要的专业建议，重点覆盖：',
    '1. 你的核心判断',
    '2. 最值得优先处理的风险',
    '3. 接下来 2-4 条最重要的行动建议',
  ].join('\n');
}
