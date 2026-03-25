import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendTaskRoute } from '../orchestration/task-routing';

test('architecture-oriented work routes to software-architect', () => {
  const decision = recommendTaskRoute({
    title: 'Refactor server composition',
    description: 'Split route registration from domain logic and clarify architecture boundaries',
  });

  assert.equal(decision.recommendedAgentRole, 'software-architect');
  assert.equal(decision.routingStatus, 'matched');
  assert.equal(decision.executionMode, 'serial');
});

test('documentation-oriented work routes to technical-writer', () => {
  const decision = recommendTaskRoute({
    title: 'Write integration guide',
    description: 'Document the workflow and user manual for the new runtime foundation',
  });

  assert.equal(decision.recommendedAgentRole, 'technical-writer');
  assert.equal(decision.routingStatus, 'matched');
});

test('unknown work falls back to manual review', () => {
  const decision = recommendTaskRoute({
    title: 'Mystery task',
    description: 'Something vague with no obvious owner',
  });

  assert.equal(decision.recommendedAgentRole, 'dispatcher');
  assert.equal(decision.routingStatus, 'manual_review');
});
