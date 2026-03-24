import test from 'node:test';
import assert from 'node:assert/strict';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import { runDiscussionWorkflow } from '../orchestration/discussion-workflow';

function makeParticipant(id: string, name: string, hiredForTask = false): DiscussionParticipant {
  return {
    id,
    name,
    description: `${name} description`,
    department: 'engineering',
    score: 90,
    isActive: !hiredForTask,
    hiredForTask,
    assignment: `Assignment for ${name}`,
  };
}

test('runDiscussionWorkflow hires, collects, synthesizes, and returns final result', async () => {
  const participants = [makeParticipant('architect', 'Architect', true), makeParticipant('reviewer', 'Reviewer')];
  const events: string[] = [];

  const result = await runDiscussionWorkflow({
    topic: 'Architecture review',
    participants,
    onProgress: (stage) => events.push(stage),
    onDiscussionStarted: () => events.push('started'),
    onDiscussionCompleted: () => events.push('done'),
    hireExperts: () => ({
      hired: [{ id: 'architect', name: 'Architect' }],
      alreadyActive: [],
      missing: [],
    }),
    collectReplies: async () => ({
      participants: participants.map((participant) => ({ ...participant, response: `reply:${participant.id}` })),
      failedParticipants: [],
      executorUsed: 'codex',
      degraded: false,
    }),
    synthesize: async () => ({
      text: 'synthesis',
      executor: 'codex',
    }),
  });

  assert.equal(result.topic, 'Architecture review');
  assert.equal(result.participants.length, 2);
  assert.equal(result.synthesis, 'synthesis');
  assert.equal(result.executor, 'codex');
  assert.equal(result.degraded, false);
  assert.equal(result.failedParticipants.length, 0);
  assert.deepEqual(events, ['preparing-squad', 'hiring-experts', 'started', 'assigning-tasks', 'synthesizing', 'completed', 'done']);
});

test('runDiscussionWorkflow degrades when a participant reply fails', async () => {
  const participants = [makeParticipant('architect', 'Architect', true), makeParticipant('reviewer', 'Reviewer')];
  const synthInputs: DiscussionParticipant[][] = [];

  const result = await runDiscussionWorkflow({
    topic: 'Architecture review',
    participants,
    onProgress: () => undefined,
    onDiscussionStarted: () => undefined,
    onDiscussionCompleted: () => undefined,
    hireExperts: () => ({
      hired: [{ id: 'architect', name: 'Architect' }],
      alreadyActive: [],
      missing: [],
    }),
    collectReplies: async () => ({
      participants: [
        { ...participants[0], response: 'reply:architect' },
        { ...participants[1], failed: true, failureReason: 'reviewer failed' },
      ],
      failedParticipants: [
        { ...participants[1], failed: true, failureReason: 'reviewer failed' },
      ],
      executorUsed: 'claude',
      degraded: true,
    }),
    synthesize: async (successfulParticipants) => {
      synthInputs.push(successfulParticipants);
      return {
        text: 'synthesis',
        executor: 'openai',
      };
    },
  });

  assert.equal(result.degraded, true);
  assert.equal(result.failedParticipants.length, 1);
  assert.equal(result.participants[1]?.failed, true);
  assert.equal(synthInputs.length, 1);
  assert.equal(synthInputs[0].length, 1);
  assert.equal(synthInputs[0][0]?.id, 'architect');
  assert.equal(result.executor, 'claude');
});
