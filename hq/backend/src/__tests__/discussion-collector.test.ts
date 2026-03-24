import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import { collectDiscussionReplies } from '../orchestration/discussion-collector';

function makeAgent(id: string, name: string): Agent {
  return {
    id,
    filePath: `/tmp/${id}.md`,
    department: 'engineering',
    frontmatter: { name, description: `${name} description` },
    content: '',
    systemPrompt: '',
  };
}

function makeParticipant(id: string, name: string): DiscussionParticipant {
  return {
    id,
    name,
    description: `${name} description`,
    department: 'engineering',
    score: 80,
    isActive: true,
    hiredForTask: false,
    assignment: `Assignment for ${name}`,
  };
}

test('collectDiscussionReplies returns completed participants with responses', async () => {
  const participants = [makeParticipant('architect', 'Architect'), makeParticipant('reviewer', 'Reviewer')];
  const events: string[] = [];

  const result = await collectDiscussionReplies(participants, {
    getAgent: (id) => (id === 'architect' ? makeAgent('architect', 'Architect') : makeAgent('reviewer', 'Reviewer')),
    onAssigned: (participant) => events.push(`assigned:${participant.id}`),
    onWorking: (participant) => events.push(`working:${participant.id}`),
    onProgress: (participant, _index, _total) => events.push(`progress:${participant.id}`),
    onCompleted: (participant) => events.push(`completed:${participant.id}`),
    onFailed: (participant, reason) => events.push(`failed:${participant.id}:${reason}`),
    generateReply: async (_agent, assignment) => ({
      text: `reply:${assignment}`,
      executor: 'codex',
    }),
  });

  assert.equal(result.participants.length, 2);
  assert.equal(result.participants[0]?.response?.startsWith('reply:'), true);
  assert.equal(result.executorUsed, 'codex');
  assert.deepEqual([...events].sort(), [
    'assigned:architect',
    'assigned:reviewer',
    'completed:architect',
    'completed:reviewer',
    'progress:architect',
    'progress:reviewer',
    'working:architect',
    'working:reviewer',
  ]);
});

test('collectDiscussionReplies bounds reply concurrency and keeps partial failures', async () => {
  const participants = [
    makeParticipant('architect', 'Architect'),
    makeParticipant('reviewer', 'Reviewer'),
    makeParticipant('planner', 'Planner'),
  ];
  let activeReplies = 0;
  let maxActiveReplies = 0;

  const result = await collectDiscussionReplies(participants, {
    getAgent: (id) => makeAgent(id, id),
    onAssigned: () => undefined,
    onWorking: () => undefined,
    onProgress: () => undefined,
    onCompleted: () => undefined,
    onFailed: () => undefined,
    generateReply: async (agent, assignment) => {
      activeReplies += 1;
      maxActiveReplies = Math.max(maxActiveReplies, activeReplies);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeReplies -= 1;

      if (agent.id === 'reviewer') {
        throw new Error('reviewer failed');
      }

      return {
        text: `reply:${assignment}`,
        executor: 'claude',
      };
    },
  });

  assert.equal(maxActiveReplies <= 2, true);
  assert.equal(result.participants.length, 3);
  assert.equal(result.failedParticipants.length, 1);
  assert.equal(result.degraded, true);
  assert.equal(result.participants[1]?.failed, true);
  assert.equal(result.participants[1]?.failureReason, 'reviewer failed');
});
