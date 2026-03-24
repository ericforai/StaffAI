import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscussionEventPublisher } from '../observability/discussion-event-publisher';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import type { DashboardEvent } from '../observability/dashboard-events';

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

test('discussion event publisher emits tool progress event payload', () => {
  const events: DashboardEvent[] = [];
  const publisher = createDiscussionEventPublisher((event) => events.push(event));

  publisher.toolProgress('expert_discussion', 'collecting-replies', 'running', 64, 'collecting', 'codex');

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    type: 'TOOL_PROGRESS',
    tool: 'expert_discussion',
    stage: 'collecting-replies',
    status: 'running',
    progress: 64,
    message: 'collecting',
    executor: 'codex',
  });
});

test('discussion event publisher emits discussion lifecycle events', () => {
  const events: DashboardEvent[] = [];
  const publisher = createDiscussionEventPublisher((event) => events.push(event));
  const participants = [makeParticipant('a1', 'Architect'), makeParticipant('a2', 'Reviewer')];

  publisher.discussionStarted('Topic A', participants, ['a1']);
  publisher.discussionCompleted('Topic A', participants);

  assert.equal(events.length, 3);
  assert.equal(events[0]?.type, 'DISCUSSION_STARTED');
  assert.equal(events[0]?.participantCount, 2);
  assert.deepEqual(events[0]?.hiredAgentIds, ['a1']);
  assert.equal(events[1]?.type, 'DISCUSSION_COMPLETED');
  assert.equal(events[1]?.participantCount, 2);
  assert.equal(events[2]?.type, 'TOOL_PROGRESS');
  assert.equal(events[2]?.status, 'completed');
});

test('discussion event publisher emits agent activity events', () => {
  const events: DashboardEvent[] = [];
  const publisher = createDiscussionEventPublisher((event) => events.push(event));
  const participant = makeParticipant('a3', 'Ops');

  publisher.agentAssigned('Topic B', participant);
  publisher.agentWorking('Topic B', participant);
  publisher.agentTaskCompleted('Topic B', participant);
  publisher.agentHired('a3', 'Ops');

  assert.deepEqual(events.map((event) => event.type), [
    'AGENT_ASSIGNED',
    'AGENT_WORKING',
    'AGENT_TASK_COMPLETED',
    'AGENT_HIRED',
  ]);
  assert.equal(events[0]?.topic, 'Topic B');
  assert.equal(events[2]?.task, 'Topic B');
  assert.equal(events[3]?.agentId, 'a3');
});
