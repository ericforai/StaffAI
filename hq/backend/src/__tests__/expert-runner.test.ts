import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeContext,
  buildExpertPrompt,
  buildSynthesisPrompt,
  formatParticipantResponses,
} from '../runtime/expert-runner';

test('buildKnowledgeContext formats prior knowledge entries', () => {
  const context = buildKnowledgeContext(
    'review architecture',
    [
      {
        task: 'review architecture',
        agentId: 'software-architect',
        resultSummary: 'Prefer explicit boundaries.',
      },
    ],
    (agentId) =>
      agentId === 'software-architect'
        ? {
            id: 'software-architect',
            filePath: '/tmp/software-architect.md',
            department: 'engineering',
            frontmatter: { name: 'Software Architect', description: 'Owns architecture.' },
            content: '',
            systemPrompt: '',
          }
        : undefined,
  );

  assert.equal(context.includes('相关历史经验参考'), true);
  assert.equal(context.includes('Software Architect'), true);
  assert.equal(context.includes('Prefer explicit boundaries.'), true);
});

test('buildExpertPrompt combines assignment and knowledge context', () => {
  const prompt = buildExpertPrompt('Focus on architecture risks', '\n\n---\nknowledge');
  assert.equal(prompt.includes('Focus on architecture risks'), true);
  assert.equal(prompt.includes('knowledge'), true);
});

test('buildSynthesisPrompt includes participant responses', () => {
  const prompt = buildSynthesisPrompt('Architecture review', [
    { name: 'Architect', response: 'Use modules.' },
    { name: 'Reviewer', response: 'Protect regression paths.' },
  ]);

  assert.equal(prompt.includes('讨论主题：Architecture review'), true);
  assert.equal(prompt.includes('Architect'), true);
  assert.equal(prompt.includes('Protect regression paths.'), true);
});

test('formatParticipantResponses accepts a custom formatter', () => {
  const formatted = formatParticipantResponses(
    [{ name: 'Designer', response: 'Sketch flows.' }],
    (participant, index) => `#${index + 1} ${participant.name}: ${participant.response}`,
  );

  assert.equal(formatted, '#1 Designer: Sketch flows.');
});

test('buildSynthesisPrompt can override section list', () => {
  const prompt = buildSynthesisPrompt(
    'Synthesis sprint',
    [{ name: 'Expert', response: 'Go fast.' }],
    { sectionLines: ['A. Consensus', 'B. Risks'] },
  );

  assert.equal(prompt.includes('A. Consensus'), true);
  assert.equal(prompt.includes('B. Risks'), true);
});
