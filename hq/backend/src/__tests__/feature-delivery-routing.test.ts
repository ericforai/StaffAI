import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendTaskRoute } from '../orchestration/task-routing';
import { buildAssignmentRoleSequence } from '../orchestration/task-orchestrator';

test('Task Routing should identify feature_delivery from keywords', () => {
  const result = recommendTaskRoute({
    title: 'New Feature',
    description: 'We need an end-to-end delivery of the lead management feature.'
  });
  
  assert.strictEqual(result.taskType, 'feature_delivery');
  assert.strictEqual(result.recommendedAgentRole, 'sprint-prioritizer');
});

test('Role Sequence for feature_delivery should have 6 roles in order', () => {
  const routeDecision = {
    taskType: 'feature_delivery' as any,
    recommendedAgentRole: 'sprint-prioritizer',
    candidateAgentRoles: [],
    reason: 'Test',
    routingStatus: 'matched' as any,
    executionMode: 'serial' as any
  };
  
  const sequence = buildAssignmentRoleSequence(routeDecision);
  
  assert.strictEqual(sequence.length, 6);
  assert.strictEqual(sequence[0].role, 'sprint-prioritizer');
  assert.strictEqual(sequence[1].role, 'software-architect');
  assert.strictEqual(sequence[2].role, 'frontend-developer');
  assert.strictEqual(sequence[3].role, 'backend-architect');
  assert.strictEqual(sequence[4].role, 'security-engineer');
  assert.strictEqual(sequence[5].role, 'code-reviewer');
});
