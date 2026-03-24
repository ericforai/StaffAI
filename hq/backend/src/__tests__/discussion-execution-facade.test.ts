import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import {
  createDiscussionExecutionFacade,
  DISCUSSION_HOST_SYSTEM_PROMPT,
} from '../runtime/discussion-execution-facade';

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

test('discussion execution facade builds expert prompt with knowledge context and delegates to runtime', async () => {
  let capturedSystemPrompt = '';
  let capturedUserPrompt = '';
  let searchedTask = '';
  const facade = createDiscussionExecutionFacade({
    runtime: {
      generateText: async (systemPrompt, userPrompt) => {
        capturedSystemPrompt = systemPrompt;
        capturedUserPrompt = userPrompt;
        return { text: 'expert reply', executor: 'codex' };
      },
    },
    searchKnowledge: (task) => {
      searchedTask = task;
      return [
        {
          task: 'Prior architecture review',
          agentId: 'reviewer',
          resultSummary: 'Keep module boundaries explicit.',
        },
      ];
    },
    getAgent: (id) => (id === 'reviewer' ? makeAgent('reviewer', 'Reviewer') : undefined),
  });

  const result = await facade.generateExpertReply(makeAgent('architect', 'Architect'), 'Assess architecture risks');
  assert.equal(result.text, 'expert reply');
  assert.equal(result.executor, 'codex');
  assert.equal(capturedSystemPrompt, 'You are Architect');
  assert.equal(searchedTask, 'Assess architecture risks');
  assert.equal(capturedUserPrompt.includes('Assess architecture risks'), true);
  assert.equal(capturedUserPrompt.includes('相关历史经验参考'), true);
  assert.equal(capturedUserPrompt.includes('Reviewer'), true);
});

test('discussion execution facade builds synthesis prompt with host system prompt', async () => {
  let capturedSystemPrompt = '';
  let capturedUserPrompt = '';
  const facade = createDiscussionExecutionFacade({
    runtime: {
      generateText: async (systemPrompt, userPrompt) => {
        capturedSystemPrompt = systemPrompt;
        capturedUserPrompt = userPrompt;
        return { text: 'synthesis text', executor: 'claude' };
      },
    },
    searchKnowledge: () => [],
    getAgent: () => undefined,
  });

  const result = await facade.synthesizeDiscussion('Architecture topic', [
    {
      id: 'architect',
      name: 'Architect',
      description: 'architect',
      department: 'engineering',
      score: 95,
      isActive: true,
      hiredForTask: false,
      assignment: 'Architect assignment',
      response: 'We should split modules.',
    },
  ]);

  assert.equal(result.text, 'synthesis text');
  assert.equal(result.executor, 'claude');
  assert.equal(capturedSystemPrompt, DISCUSSION_HOST_SYSTEM_PROMPT);
  assert.equal(capturedUserPrompt.includes('讨论主题：Architecture topic'), true);
  assert.equal(capturedUserPrompt.includes('We should split modules.'), true);
});
