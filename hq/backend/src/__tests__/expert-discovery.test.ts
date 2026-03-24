import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import { createExpertDiscoveryService } from '../orchestration/expert-discovery';

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

test('expert discovery ranks architecture work toward software architect', () => {
  const service = createExpertDiscoveryService({
    getAllAgents: () => [
      makeAgent('software-architect', 'Software Architect', 'Designs architecture and boundaries.'),
      makeAgent('technical-writer', 'Technical Writer', 'Writes docs and manuals.'),
    ],
    getActiveIds: () => [],
  });

  const [first] = service.searchExperts('Need help with architecture boundaries', 2);
  assert.equal(first?.id, 'software-architect');
  assert.equal(first?.department, 'engineering');
});

test('expert discovery prefers active experts when scores tie', () => {
  const service = createExpertDiscoveryService({
    getAllAgents: () => [
      makeAgent('architect-a', 'Architect A', 'Handles architecture reviews.'),
      makeAgent('architect-b', 'Architect B', 'Handles architecture reviews.'),
    ],
    getActiveIds: () => ['architect-b'],
  });

  const [first] = service.searchExperts('architecture review', 2);
  assert.equal(first?.id, 'architect-b');
  assert.equal(first?.isActive, true);
});
