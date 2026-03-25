import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import {
  createPromptBuilder,
  buildKnowledgeContext,
  buildExpertPrompt,
  buildSynthesisPrompt,
  formatParticipantResponses,
  type PromptContext,
  type KnowledgeEntryLike,
  type ParticipantFormatter,
  type SynthesisOptions,
} from '../runtime/prompt-builder';

// Test fixtures
const mockAgent: Agent = {
  id: 'software-architect',
  filePath: '/tmp/software-architect.md',
  department: 'engineering',
  frontmatter: { name: 'Software Architect', description: 'Owns architecture.' },
  content: '',
  systemPrompt: '',
};

const mockGetAgent = (agentId: string): Agent | undefined =>
  agentId === 'software-architect' ? mockAgent : undefined;

const mockKnowledgeEntry: KnowledgeEntryLike = {
  task: 'review architecture',
  agentId: 'software-architect',
  resultSummary: 'Prefer explicit boundaries.',
};

const mockParticipants: Array<Pick<DiscussionParticipant, 'name' | 'response'>> = [
  { name: 'Architect', response: 'Use modules.' },
  { name: 'Reviewer', response: 'Protect regression paths.' },
];

// ============================================================================
// buildKnowledgeContext Tests
// ============================================================================

test('buildKnowledgeContext returns empty string for empty history', () => {
  const context = buildKnowledgeContext('some task', [], mockGetAgent);
  assert.equal(context, '');
});

test('buildKnowledgeContext formats single knowledge entry with agent name', () => {
  const context = buildKnowledgeContext('review architecture', [mockKnowledgeEntry], mockGetAgent);

  assert.equal(context.includes('相关历史经验参考'), true);
  assert.equal(context.includes('Software Architect'), true);
  assert.equal(context.includes('Prefer explicit boundaries.'), true);
  assert.equal(context.includes('review architecture'), true);
});

test('buildKnowledgeContext formats multiple knowledge entries', () => {
  const entries: KnowledgeEntryLike[] = [
    mockKnowledgeEntry,
    { task: 'design database', agentId: 'software-architect', resultSummary: 'Use PostgreSQL.' },
  ];

  const context = buildKnowledgeContext('database design', entries, mockGetAgent);

  // Should have numbered entries
  assert.equal(context.includes('1.'), true);
  assert.equal(context.includes('2.'), true);
  assert.equal(context.includes('review architecture'), true);
  assert.equal(context.includes('design database'), true);
  assert.equal(context.includes('Use PostgreSQL.'), true);
});

test('buildKnowledgeContext uses agentId when agent not found', () => {
  const context = buildKnowledgeContext(
    'test task',
    [{ task: 'unknown task', agentId: 'unknown-agent', resultSummary: 'Unknown result.' }],
    () => undefined,
  );

  assert.equal(context.includes('unknown-agent'), true);
  assert.equal(context.includes('Unknown result.'), true);
});

test('buildKnowledgeContext formats each entry with correct structure', () => {
  const context = buildKnowledgeContext('test', [mockKnowledgeEntry], mockGetAgent);

  // Should contain the labeled sections
  assert.equal(context.includes('【任务】'), true);
  assert.equal(context.includes('【专家】'), true);
  assert.equal(context.includes('【结果】'), true);
});

// ============================================================================
// buildExpertPrompt Tests
// ============================================================================

test('buildExpertPrompt combines assignment and knowledge context', () => {
  const prompt = buildExpertPrompt('Focus on architecture risks', '\n\n---\nknowledge');

  assert.equal(prompt.includes('Focus on architecture risks'), true);
  assert.equal(prompt.includes('knowledge'), true);
});

test('buildExpertPrompt with empty knowledge context', () => {
  const prompt = buildExpertPrompt('Do this task', '');

  assert.equal(prompt, 'Do this task');
});

test('buildExpertPrompt with only knowledge context', () => {
  const prompt = buildExpertPrompt('', '\n\n---\nknowledge');

  assert.equal(prompt, '\n\n---\nknowledge');
});

// ============================================================================
// formatParticipantResponses Tests
// ============================================================================

test('formatParticipantResponses uses default formatter', () => {
  const formatted = formatParticipantResponses([
    { name: 'Designer', response: 'Sketch flows.' },
  ]);

  assert.equal(formatted.includes('## 专家 1: Designer'), true);
  assert.equal(formatted.includes('Sketch flows.'), true);
});

test('formatParticipantResponses formats multiple participants', () => {
  const formatted = formatParticipantResponses(mockParticipants);

  assert.equal(formatted.includes('## 专家 1: Architect'), true);
  assert.equal(formatted.includes('## 专家 2: Reviewer'), true);
  assert.equal(formatted.includes('Use modules.'), true);
  assert.equal(formatted.includes('Protect regression paths.'), true);
});

test('formatParticipantResponses accepts custom formatter', () => {
  const formatted = formatParticipantResponses(
    [{ name: 'Designer', response: 'Sketch flows.' }],
    (participant: Pick<DiscussionParticipant, 'name' | 'response'>, index: number) =>
      `#${index + 1} ${participant.name}: ${participant.response || ''}`,
  );

  assert.equal(formatted, '#1 Designer: Sketch flows.');
});

test('formatParticipantResponses handles empty response', () => {
  const formatted = formatParticipantResponses([{ name: 'Expert', response: '' }]);

  assert.equal(formatted.includes('未返回结果'), true);
});

test('formatParticipantResponses handles undefined response', () => {
  const formatted = formatParticipantResponses([{ name: 'Expert', response: undefined }]);

  assert.equal(formatted.includes('未返回结果'), true);
});

test('formatParticipantResponses handles multiple participants with custom formatter', () => {
  const formatted = formatParticipantResponses(
    mockParticipants,
    (participant: Pick<DiscussionParticipant, 'name' | 'response'>, index: number) =>
      `${index + 1}. ${participant.name}: ${participant.response}`,
  );

  assert.match(formatted, /1\. Architect/);
  assert.match(formatted, /2\. Reviewer/);
});

// ============================================================================
// buildSynthesisPrompt Tests
// ============================================================================

test('buildSynthesisPrompt includes topic and participant responses', () => {
  const prompt = buildSynthesisPrompt('Architecture review', mockParticipants);

  assert.equal(prompt.includes('讨论主题：Architecture review'), true);
  assert.equal(prompt.includes('Architect'), true);
  assert.equal(prompt.includes('Protect regression paths.'), true);
});

test('buildSynthesisPrompt includes default sections', () => {
  const prompt = buildSynthesisPrompt('Review', mockParticipants);

  assert.equal(prompt.includes('1. 共识'), true);
  assert.equal(prompt.includes('2. 分歧'), true);
  assert.equal(prompt.includes('3. 推荐行动方案'), true);
  assert.equal(prompt.includes('4. 建议的下一步负责人'), true);
});

test('buildSynthesisPrompt can override section list', () => {
  const prompt = buildSynthesisPrompt(
    'Synthesis sprint',
    [{ name: 'Expert', response: 'Go fast.' }],
    { sectionLines: ['A. Consensus', 'B. Risks'] },
  );

  assert.equal(prompt.includes('A. Consensus'), true);
  assert.equal(prompt.includes('B. Risks'), true);
  assert.equal(prompt.includes('1. 共识'), false);
});

test('buildSynthesisPrompt uses custom participant formatter', () => {
  const prompt = buildSynthesisPrompt(
    'Test',
    [{ name: 'Expert', response: 'Response.' }],
    {
      participantFormatter: (participant: Pick<DiscussionParticipant, 'name' | 'response'>, index: number) =>
        `Expert ${index + 1}: ${participant.response}`,
    },
  );

  assert.equal(prompt.includes('Expert 1: Response.'), true);
  assert.equal(prompt.includes('## 专家'), false);
});

test('buildSynthesisPrompt with empty participants list', () => {
  const prompt = buildSynthesisPrompt('Empty topic', []);

  assert.equal(prompt.includes('讨论主题：Empty topic'), true);
  assert.equal(prompt.includes('请综合以下专家意见'), true);
});

test('buildSynthesisPrompt with both custom options', () => {
  const prompt = buildSynthesisPrompt(
    'Custom test',
    [{ name: 'A', response: 'X' }, { name: 'B', response: 'Y' }],
    {
      sectionLines: ['1. Summary', '2. Action'],
      participantFormatter: (participant: Pick<DiscussionParticipant, 'name' | 'response'>) =>
        `- ${participant.name}: ${participant.response}`,
    },
  );

  assert.equal(prompt.includes('1. Summary'), true);
  assert.equal(prompt.includes('2. Action'), true);
  assert.equal(prompt.includes('- A: X'), true);
  assert.equal(prompt.includes('- B: Y'), true);
});

// ============================================================================
// PromptBuilder Interface Tests
// ============================================================================

test('createPromptBuilder returns a PromptBuilder instance', () => {
  const builder = createPromptBuilder();

  assert.notEqual(builder, null);
  assert.notEqual(builder, undefined);
  assert.equal(typeof builder.buildExpertPrompt, 'function');
  assert.equal(typeof builder.buildSynthesisPrompt, 'function');
  assert.equal(typeof builder.buildKnowledgeContext, 'function');
  assert.equal(typeof builder.formatParticipantResponses, 'function');
});

test('PromptBuilder.buildExpertPrompt combines context correctly', () => {
  const builder = createPromptBuilder();
  const context: PromptContext = {
    assignment: 'Test assignment',
    knowledgeContext: '\n\n---\nKnowledge',
  };

  const prompt = builder.buildExpertPrompt(context);

  assert.equal(prompt.includes('Test assignment'), true);
  assert.equal(prompt.includes('Knowledge'), true);
});

test('PromptBuilder.buildSynthesisPrompt creates correct synthesis', () => {
  const builder = createPromptBuilder();
  const participants: DiscussionParticipant[] = [
    { id: '1', name: 'Expert', description: 'Test', department: 'test', score: 0, isActive: true, hiredForTask: false, assignment: '', response: 'Response' },
  ];

  const prompt = builder.buildSynthesisPrompt('Test topic', participants);

  assert.equal(prompt.includes('讨论主题：Test topic'), true);
  assert.equal(prompt.includes('Response'), true);
});

test('PromptBuilder.buildKnowledgeContext formats history correctly', () => {
  const builder = createPromptBuilder();

  const context = builder.buildKnowledgeContext('test', [mockKnowledgeEntry], mockGetAgent);

  assert.equal(context.includes('相关历史经验参考'), true);
  assert.equal(context.includes('Software Architect'), true);
});

test('PromptBuilder.formatParticipantResponses formats correctly', () => {
  const builder = createPromptBuilder();

  const formatted = builder.formatParticipantResponses([
    { name: 'Expert', response: 'Result' },
  ]);

  assert.equal(formatted.includes('## 专家 1: Expert'), true);
  assert.equal(formatted.includes('Result'), true);
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

test('buildKnowledgeContext with special characters in entries', () => {
  const specialEntry: KnowledgeEntryLike = {
    task: 'Task with "quotes" and \'apostrophes\'',
    agentId: 'test-agent',
    resultSummary: 'Result with <special> & characters',
  };

  const context = buildKnowledgeContext('test', [specialEntry], () => undefined);

  assert.equal(context.includes('Task with "quotes" and \'apostrophes\''), true);
  assert.equal(context.includes('Result with <special> & characters'), true);
});

test('formatParticipantResponses with very long response', () => {
  const longResponse = 'A'.repeat(1000);
  const formatted = formatParticipantResponses([{ name: 'Expert', response: longResponse }]);

  assert.equal(formatted.includes(longResponse), true);
});

test('buildSynthesisPrompt preserves order of participants', () => {
  const participants: DiscussionParticipant[] = [
    { id: '1', name: 'First', description: '', department: '', score: 0, isActive: true, hiredForTask: false, assignment: '', response: '1' },
    { id: '2', name: 'Second', description: '', department: '', score: 0, isActive: true, hiredForTask: false, assignment: '', response: '2' },
    { id: '3', name: 'Third', description: '', department: '', score: 0, isActive: true, hiredForTask: false, assignment: '', response: '3' },
  ];

  const builder = createPromptBuilder();
  const prompt = builder.buildSynthesisPrompt('Test', participants);

  const firstIndex = prompt.indexOf('First');
  const secondIndex = prompt.indexOf('Second');
  const thirdIndex = prompt.indexOf('Third');

  assert.ok(firstIndex < secondIndex);
  assert.ok(secondIndex < thirdIndex);
});
