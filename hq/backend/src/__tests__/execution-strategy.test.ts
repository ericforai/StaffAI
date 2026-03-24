import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExecutionMode, resolveExecutionDecision } from '../execution-strategy';

test('auto mode uses parallel when sampling is available', () => {
  const decision = resolveExecutionDecision({ sampling: true }, 'auto');
  assert.equal(decision.appliedMode, 'parallel');
  assert.equal(decision.degraded, false);
  assert.equal(decision.blocked, false);
});

test('auto mode degrades to serial when sampling is unavailable', () => {
  const decision = resolveExecutionDecision({ sampling: false }, 'auto');
  assert.equal(decision.appliedMode, 'serial');
  assert.equal(decision.degraded, true);
  assert.equal(decision.blocked, false);
  assert.ok(decision.notice);
});

test('require_sampling mode is blocked when sampling is unavailable', () => {
  const decision = resolveExecutionDecision({ sampling: false }, 'require_sampling');
  assert.equal(decision.blocked, true);
  assert.ok(decision.error);
  assert.equal(decision.error?.actions.length, 3);
});

test('force_serial mode always uses serial without degradation', () => {
  const withSampling = resolveExecutionDecision({ sampling: true }, 'force_serial');
  const withoutSampling = resolveExecutionDecision({ sampling: false }, 'force_serial');
  assert.equal(withSampling.appliedMode, 'serial');
  assert.equal(withoutSampling.appliedMode, 'serial');
  assert.equal(withSampling.degraded, false);
  assert.equal(withoutSampling.degraded, false);
});

test('normalizeExecutionMode falls back to auto for invalid values', () => {
  assert.equal(normalizeExecutionMode(undefined), 'auto');
  assert.equal(normalizeExecutionMode(''), 'auto');
  assert.equal(normalizeExecutionMode('parallel'), 'auto');
  assert.equal(normalizeExecutionMode('force_serial'), 'force_serial');
});
