import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import { calculateSmartScore, getFeatures, rankExperts } from '../orchestration/expert-ranking';

function makeAgent(id: string, name: string, description: string, department = 'engineering'): Agent {
  return {
    id,
    filePath: `/tmp/${id}.md`,
    department,
    frontmatter: {
      name,
      description,
    },
    content: '',
    systemPrompt: '',
  };
}

test('getFeatures extracts both words and chinese chars', () => {
  const features = getFeatures('Architecture 评审 architecture');
  assert.equal(features.get('architecture'), 2);
  assert.equal(features.get('评'), 1);
  assert.equal(features.get('审'), 1);
});

test('calculateSmartScore prefers matches in name/id over description', () => {
  const nameMatch = makeAgent('software-architect', 'Software Architect', 'Builds systems');
  const descMatch = makeAgent('writer', 'Writer', 'software architecture specialist');

  const query = 'need software architect';
  const scoreFromName = calculateSmartScore(nameMatch, query);
  const scoreFromDescription = calculateSmartScore(descMatch, query);

  assert.equal(scoreFromName > scoreFromDescription, true);
});

test('rankExperts preserves tie-breaker: score -> active -> name', () => {
  const agents = [
    makeAgent('architect-z', 'Architect Z', 'Handles architecture reviews'),
    makeAgent('architect-a', 'Architect A', 'Handles architecture reviews'),
  ];

  const ranked = rankExperts({
    agents,
    topic: 'architecture review',
    activeIds: new Set<string>(['architect-z']),
    maxExperts: 2,
  });

  assert.equal(ranked[0]?.agent.id, 'architect-z');
  assert.equal(ranked[0]?.isActive, true);
});
