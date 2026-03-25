import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHostDegradation, resolveExecutorDegradation } from '../runtime/degradation-policy';

test('full hosts stay in native mode when required capabilities are available', () => {
  const result = resolveHostDegradation({
    hostId: 'claude',
    capabilityLevel: 'full',
    supportsSampling: true,
    supportsInjection: true,
    supportsRuntimeExecution: true,
    requiredCapability: 'discussion.orchestrate',
  });

  assert.equal(result.mode, 'native');
  assert.equal(result.degraded, false);
});

test('partial hosts degrade to advisory mode when injection is unsupported', () => {
  const result = resolveHostDegradation({
    hostId: 'gemini',
    capabilityLevel: 'partial',
    supportsSampling: false,
    supportsInjection: false,
    supportsRuntimeExecution: true,
    requiredCapability: 'host.inject',
  });

  assert.equal(result.mode, 'advisory');
  assert.equal(result.degraded, true);
  assert.equal(result.notice.includes('manual'), true);
});

test('executor degradation falls back to serial when sampling is unavailable', () => {
  const result = resolveExecutorDegradation({
    preferredExecutor: 'codex',
    availableExecutors: ['codex'],
    requiresSampling: true,
    supportsSampling: false,
  });

  assert.equal(result.executor, 'codex');
  assert.equal(result.executionMode, 'serial');
  assert.equal(result.degraded, true);
});

test('executor degradation returns manual mode when no executor is available', () => {
  const result = resolveExecutorDegradation({
    preferredExecutor: 'claude',
    availableExecutors: [],
    requiresSampling: false,
    supportsSampling: false,
  });

  assert.equal(result.executor, 'manual');
  assert.equal(result.executionMode, 'manual');
  assert.equal(result.degraded, true);
});
