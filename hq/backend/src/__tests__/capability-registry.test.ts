import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRegistry, bindAgentCapabilities } from '../runtime/capability-registry';
import type { Agent } from '../types';

const reviewAgent: Agent = {
  id: 'code-reviewer',
  filePath: '/tmp/code-reviewer.md',
  department: 'engineering',
  frontmatter: {
    name: 'Code Reviewer',
    description: 'Reviews code and release readiness',
    tools: 'review,ship',
  },
  content: 'content',
  systemPrompt: 'prompt',
};

test('capability registry exposes core runtime capabilities', () => {
  const registry = createCapabilityRegistry();
  assert.equal(registry.some((item) => item.id === 'discussion.orchestrate'), true);
  assert.equal(registry.some((item) => item.id === 'workflow.recommend'), true);
  assert.equal(registry.some((item) => item.id === 'host.inject'), true);
});

test('bindAgentCapabilities maps tools and department to runtime capabilities', () => {
  const bound = bindAgentCapabilities(reviewAgent);
  assert.equal(bound.agentId, 'code-reviewer');
  assert.equal(bound.capabilities.includes('discussion.consult'), true);
  assert.equal(bound.capabilities.includes('workflow.recommend'), true);
  assert.equal(bound.capabilities.includes('executor.codex'), true);
});
