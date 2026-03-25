import type { JsonKnowledgeEntry } from './knowledge-types';

export function extractKnowledgeFeatures(text: string): Map<string, number> {
  const features = new Map<string, number>();
  const words = text
    .toLowerCase()
    .split(/[\s,，.。!！?？\-_/]+/)
    .filter((token) => token.length > 0);

  for (const word of words) {
    features.set(word, (features.get(word) ?? 0) + 1);
  }

  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      features.set(char, (features.get(char) ?? 0) + 1);
    }
  }

  return features;
}

export function calculateKnowledgeScore(entry: JsonKnowledgeEntry, query: string): number {
  const queryFeatures = extractKnowledgeFeatures(query);
  const taskFeatures = extractKnowledgeFeatures(entry.task);
  const resultFeatures = extractKnowledgeFeatures(entry.resultSummary);
  const agentFeatures = extractKnowledgeFeatures(entry.agentId);

  let score = 0;
  for (const [feature, count] of queryFeatures) {
    if (taskFeatures.has(feature)) {
      score += count * taskFeatures.get(feature)! * 5;
    }
    if (resultFeatures.has(feature)) {
      score += count * resultFeatures.get(feature)! * 3;
    }
    if (agentFeatures.has(feature)) {
      score += count * agentFeatures.get(feature)! * 2;
    }
  }

  return score;
}
