import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import { createDiscussionRosterService } from '../orchestration/discussion-roster';

function makeAgent(id: string, name: string, description: string): Agent {
  return {
    id,
    filePath: `/tmp/${id}.md`,
    department: 'engineering',
    frontmatter: { name, description },
    content: '',
    systemPrompt: '',
  };
}

test('discussion roster prepares participants from discovered experts', () => {
  const architect = makeAgent('software-architect', 'Software Architect', 'Handles architecture boundaries.');
  const writer = makeAgent('technical-writer', 'Technical Writer', 'Writes concise summaries.');

  const service = createDiscussionRosterService({
    searchExperts: () => [
      {
        id: architect.id,
        name: architect.frontmatter.name,
        description: architect.frontmatter.description,
        department: architect.department,
        score: 99,
        isActive: false,
      },
      {
        id: writer.id,
        name: writer.frontmatter.name,
        description: writer.frontmatter.description,
        department: writer.department,
        score: 88,
        isActive: true,
      },
    ],
    getAgent: (id) => (id === architect.id ? architect : id === writer.id ? writer : undefined),
  });

  const participants = service.prepareDiscussion('Need an architecture discussion', 2);
  assert.equal(participants.length, 2);
  assert.equal(participants[0]?.hiredForTask, true);
  assert.equal(participants[1]?.hiredForTask, false);
  assert.equal(participants[0]?.assignment.includes('当前讨论阵容：'), true);
});

test('discussion roster can prepare explicit agent selections', () => {
  const architect = makeAgent('software-architect', 'Software Architect', 'Handles architecture boundaries.');

  const service = createDiscussionRosterService({
    searchExperts: () => [],
    getAgent: (id) => (id === architect.id ? architect : undefined),
  });

  const participants = service.prepareDiscussion('Need an architecture discussion', 3, [architect.id]);
  assert.equal(participants.length, 1);
  assert.equal(participants[0]?.id, architect.id);
  assert.equal(participants[0]?.score >= 0, true);
});
