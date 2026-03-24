import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import { createDiscussionWorkflowFacade } from '../orchestration/discussion-workflow-facade';

function makeParticipant(id: string, name: string, hiredForTask = false): DiscussionParticipant {
  return {
    id,
    name,
    description: `${name} description`,
    department: 'engineering',
    score: 88,
    isActive: !hiredForTask,
    hiredForTask,
    assignment: `Assignment for ${name}`,
  };
}

function makeAgent(id: string, name: string): Agent {
  return {
    id,
    filePath: `/tmp/${id}.md`,
    department: 'engineering',
    frontmatter: {
      name,
      description: `${name} description`,
    },
    content: 'content',
    systemPrompt: `You are ${name}`,
  };
}

function createNoopEvents() {
  return {
    toolProgress: () => undefined,
    consultMatchingExpert: () => undefined,
    consultHiringExpert: () => undefined,
    consultExecutingExpert: () => undefined,
    consultCompleted: () => undefined,
    discussionPreparing: () => undefined,
    discussionHiringExperts: () => undefined,
    discussionAssigningTasks: () => undefined,
    discussionCollectingReply: () => undefined,
    discussionParticipantFailed: () => undefined,
    discussionSynthesizing: () => undefined,
    discussionStarted: () => undefined,
    discussionCompleted: () => undefined,
    agentAssigned: () => undefined,
    agentWorking: () => undefined,
    agentTaskCompleted: () => undefined,
    agentTaskFailed: () => undefined,
    agentHired: () => undefined,
  };
}

test('discussion workflow facade executes discussion and prefers collected executor', async () => {
  const participants = [makeParticipant('architect', 'Architect', true), makeParticipant('reviewer', 'Reviewer')];
  const agents = new Map<string, Agent>([
    ['architect', makeAgent('architect', 'Architect')],
    ['reviewer', makeAgent('reviewer', 'Reviewer')],
  ]);

  const facade = createDiscussionWorkflowFacade({
    events: createNoopEvents(),
    hireExperts: () => ({ hired: [{ id: 'architect', name: 'Architect' }], alreadyActive: [], missing: [] }),
    getAgent: (id) => agents.get(id),
    generateExpertReply: async (_agent, assignment) => ({ text: `reply:${assignment}`, executor: 'codex' }),
    synthesizeDiscussion: async () => ({ text: 'synthesis', executor: 'openai' }),
  });

  const result = await facade.runDiscussion('Topic', participants);
  assert.equal(result.synthesis, 'synthesis');
  assert.equal(result.executor, 'codex');
  assert.equal(result.participants.length, 2);
  assert.equal(result.degraded, false);
  assert.equal(result.failedParticipants.length, 0);
});

test('discussion workflow facade rejects discussion when no participant replies succeed', async () => {
  const participants = [makeParticipant('architect', 'Architect'), makeParticipant('reviewer', 'Reviewer')];

  const facade = createDiscussionWorkflowFacade({
    events: createNoopEvents(),
    hireExperts: () => ({ hired: [], alreadyActive: [], missing: [] }),
    getAgent: () => undefined,
    generateExpertReply: async () => ({ text: 'unused', executor: 'claude' }),
    synthesizeDiscussion: async () => ({ text: 'synthesis', executor: 'openai' }),
  });

  await assert.rejects(
    () => facade.runDiscussion('Topic', participants),
    /没有任何专家回复可用于综合/,
  );
});

test('discussion workflow facade rejects discussion with fewer than two participants', async () => {
  const facade = createDiscussionWorkflowFacade({
    events: createNoopEvents(),
    hireExperts: () => ({ hired: [], alreadyActive: [], missing: [] }),
    getAgent: () => undefined,
    generateExpertReply: async () => ({ text: 'unused', executor: 'claude' }),
    synthesizeDiscussion: async () => ({ text: 'unused', executor: 'openai' }),
  });

  await assert.rejects(
    () => facade.runDiscussion('Topic', [makeParticipant('solo', 'Solo')]),
    /没有足够的专家来组织讨论/,
  );
});

test('discussion workflow facade runs consult and marks inactive expert as auto-hired', async () => {
  const expert = {
    id: 'architect',
    name: 'Architect',
    description: 'architecture expert',
    department: 'engineering',
    score: 99,
    isActive: false,
  };
  const agent = makeAgent('architect', 'Architect');
  let hireCalled = 0;

  const facade = createDiscussionWorkflowFacade({
    events: createNoopEvents(),
    hireExperts: () => {
      hireCalled += 1;
      return { hired: [{ id: 'architect', name: 'Architect' }], alreadyActive: [], missing: [] };
    },
    getAgent: () => agent,
    generateExpertReply: async () => ({ text: 'consult answer', executor: 'claude' }),
    synthesizeDiscussion: async () => ({ text: 'unused', executor: 'openai' }),
  });

  const result = await facade.runConsult('Need architecture direction', expert, agent);
  assert.equal(result.response, 'consult answer');
  assert.equal(result.executor, 'claude');
  assert.equal(result.autoHired, true);
  assert.equal(hireCalled, 1);
});
