import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import type { ExpertCandidate } from '../orchestration/expert-discovery';
import { runConsultWorkflow } from '../orchestration/consult-workflow';

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

test('runConsultWorkflow hires inactive expert, builds assignment, and returns expert reply', async () => {
  const expert: ExpertCandidate = {
    id: 'software-architect',
    name: 'Software Architect',
    description: 'Owns architecture.',
    department: 'engineering',
    score: 95,
    isActive: false,
  };
  const agent = makeAgent(expert.id, expert.name, expert.description);
  const events: string[] = [];

  const result = await runConsultWorkflow(
    {
      task: 'Review architecture direction',
      expert,
      agent,
    },
    {
      onProgress: (stage) => events.push(stage),
      hireExpert: () => {
        events.push('hired');
      },
      generateReply: async (_resolvedAgent, assignment) => ({
        text: `reply for: ${assignment}`,
        executor: 'codex',
      }),
    }
  );

  assert.equal(result.executor, 'codex');
  assert.equal(result.autoHired, true);
  assert.equal(result.expert.id, expert.id);
  assert.equal(result.response.includes('reply for:'), true);
  assert.deepEqual(events, ['matching-expert', 'hiring-expert', 'hired', 'executing-expert', 'completed']);
});
