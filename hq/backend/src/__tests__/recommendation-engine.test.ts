import test from 'node:test';
import assert from 'node:assert/strict';
import { detectWorkflowStage, buildRecommendations } from '../recommendation-engine';

test('detectWorkflowStage identifies review tasks', () => {
  const stage = detectWorkflowStage('Please review this diff before merge');
  assert.equal(stage, 'review');
});

test('detectWorkflowStage identifies debugging tasks', () => {
  const stage = detectWorkflowStage('Investigate why the discussion API is broken');
  assert.equal(stage, 'debug');
});

test('buildRecommendations returns host-aware next actions', () => {
  const result = buildRecommendations({
    topic: 'review this release candidate before ship',
    hostId: 'codex',
    capabilityLevel: 'full',
    availableExecutors: ['codex', 'claude'],
    samplingEnabled: true,
    activeAgentIds: ['code-reviewer'],
  });

  assert.equal(result.stage, 'review');
  assert.equal(result.recommendations.length > 0, true);
  assert.equal(result.recommendations.some((item) => item.action === 'run_expert_discussion'), true);
  assert.equal(result.recommendations.some((item) => item.action === 'inspect_host_injection'), true);
});

test('buildRecommendations includes degradation-aware fallback actions', () => {
  const result = buildRecommendations({
    topic: 'debug why this host cannot run discussion',
    hostId: 'gemini',
    capabilityLevel: 'partial',
    availableExecutors: [],
    samplingEnabled: false,
    activeAgentIds: [],
  });

  assert.equal(result.stage, 'debug');
  assert.equal(result.degraded, true);
  assert.equal(result.recommendations.some((item) => item.action === 'fallback_to_web_ui'), true);
});
