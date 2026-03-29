/**
 * TaskEnvelope v2 Unit Tests
 *
 * Tests construction, v1 backward compatibility, and serialization round-trip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTaskEnvelopeV2,
  parseEnvelope,
  serializeEnvelope,
  TASK_ENVELOPE_V2_VERSION,
  type TaskEnvelopeV2,
} from '../shared/task-envelope-v2';

// ============================================================================
// Helpers
// ============================================================================

function makeMinimalInput() {
  return {
    taskMetadata: {
      taskId: 'task-001',
      title: 'Test task',
      description: 'A test task description',
      taskType: 'general',
      priority: 'medium',
      executionMode: 'single',
      requestedBy: 'test-user',
      requestedAt: '2026-03-29T00:00:00.000Z',
    },
    routing: {
      recommendedAgentRole: 'dispatcher',
      candidateAgentRoles: ['dispatcher'],
      routeReason: 'Default routing',
    },
    approvalContext: {
      approvalRequired: false,
      riskLevel: 'low',
    },
    runtimeControl: {
      executor: 'claude',
    },
  };
}

// ============================================================================
// Construction Tests
// ============================================================================

test('createTaskEnvelopeV2: constructs with all fields', () => {
  const envelope = createTaskEnvelopeV2({
    ...makeMinimalInput(),
    memoryContext: { profileExcerpt: 'Some memory context', layerHints: { preferL1: true } },
    budgetControl: { timeoutMs: 30000, maxRetries: 3, maxTokens: 4096 },
    toolPolicy: { allowedTools: ['read'], blockedTools: ['write'], riskThreshold: 'low' },
    checkpoint: { checkpointRef: 'cp-001', threadId: 'thread-001', parentExecutionId: 'exec-001' },
  });

  assert.equal(envelope.version, '2.0');
  assert.equal(envelope.taskMetadata.taskId, 'task-001');
  assert.equal(envelope.memoryContext.profileExcerpt, 'Some memory context');
  assert.equal(envelope.memoryContext.layerHints?.preferL1, true);
  assert.equal(envelope.budgetControl.timeoutMs, 30000);
  assert.equal(envelope.budgetControl.maxRetries, 3);
  assert.equal(envelope.budgetControl.maxTokens, 4096);
  assert.deepEqual(envelope.toolPolicy.allowedTools, ['read']);
  assert.deepEqual(envelope.toolPolicy.blockedTools, ['write']);
  assert.equal(envelope.checkpoint.checkpointRef, 'cp-001');
  assert.equal(envelope.checkpoint.threadId, 'thread-001');
  assert.equal(envelope.checkpoint.parentExecutionId, 'exec-001');
  assert.equal(envelope.runtimeControl.executor, 'claude');
});

test('createTaskEnvelopeV2: constructs with minimal fields', () => {
  const envelope = createTaskEnvelopeV2(makeMinimalInput());

  assert.equal(envelope.version, TASK_ENVELOPE_V2_VERSION);
  assert.equal(envelope.taskMetadata.taskId, 'task-001');
  // Optional groups should be empty objects
  assert.deepEqual(envelope.memoryContext, {});
  assert.deepEqual(envelope.budgetControl, {});
  assert.deepEqual(envelope.toolPolicy, {});
  assert.deepEqual(envelope.checkpoint, {});
});

test('createTaskEnvelopeV2: version is always "2.0"', () => {
  const envelope = createTaskEnvelopeV2(makeMinimalInput());
  assert.equal(envelope.version, '2.0');
});

// ============================================================================
// v1 Backward Compatibility Tests
// ============================================================================

test('parseEnvelope: recognizes v2 envelope directly', () => {
  const v2 = createTaskEnvelopeV2(makeMinimalInput());
  const serialized = serializeEnvelope(v2);
  const parsed = parseEnvelope(serialized);

  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.taskMetadata.taskId, 'task-001');
});

test('parseEnvelope: wraps v1 envelope into v2 shape', () => {
  const v1 = {
    task_id: 'v1-task-001',
    action: 'Do something',
    agent_role: 'coder',
    identity_context: 'You are a coding assistant',
    description: 'Write some code',
    memory_context: 'Previous session notes',
    payload: { key: 'value' },
  };

  const parsed = parseEnvelope(v1);

  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.taskMetadata.taskId, 'v1-task-001');
  assert.equal(parsed.taskMetadata.title, 'Do something');
  assert.equal(parsed.taskMetadata.description, 'Write some code');
  assert.equal(parsed.routing.recommendedAgentRole, 'coder');
  assert.equal(parsed.memoryContext.profileExcerpt, 'Previous session notes');
  assert.equal(parsed.runtimeControl.executor, 'deerflow');
  assert.equal(parsed.approvalContext.approvalRequired, false);
  assert.equal(parsed.approvalContext.riskLevel, 'low');
});

test('parseEnvelope: handles minimal v1 envelope', () => {
  const v1 = { task_id: 'minimal', action: 'Run' };
  const parsed = parseEnvelope(v1);

  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.taskMetadata.taskId, 'minimal');
  assert.equal(parsed.taskMetadata.title, 'Run');
  assert.equal(parsed.taskMetadata.taskType, 'general');
  assert.equal(parsed.taskMetadata.priority, 'medium');
});

test('parseEnvelope: handles empty object gracefully', () => {
  const parsed = parseEnvelope({});
  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.taskMetadata.taskId, '');
  assert.equal(parsed.taskMetadata.title, '');
});

// ============================================================================
// Serialization Tests
// ============================================================================

test('serializeEnvelope: round-trip preserves all data', () => {
  const original = createTaskEnvelopeV2({
    ...makeMinimalInput(),
    memoryContext: { profileExcerpt: 'context', layerHints: { preferL2: true } },
    budgetControl: { timeoutMs: 60000 },
    checkpoint: { threadId: 'th-001' },
  });

  const serialized = serializeEnvelope(original);
  const parsed = parseEnvelope(serialized);

  assert.equal(parsed.version, original.version);
  assert.equal(parsed.taskMetadata.taskId, original.taskMetadata.taskId);
  assert.equal(parsed.memoryContext.profileExcerpt, 'context');
  assert.equal(parsed.memoryContext.layerHints?.preferL2, true);
  assert.equal(parsed.budgetControl.timeoutMs, 60000);
  assert.equal(parsed.checkpoint.threadId, 'th-001');
});

test('serializeEnvelope: produces plain JSON object', () => {
  const envelope = createTaskEnvelopeV2(makeMinimalInput());
  const serialized = serializeEnvelope(envelope);

  assert.equal(typeof serialized, 'object');
  assert.ok(serialized.version);
  assert.ok(serialized.taskMetadata);
  assert.ok(serialized.routing);
  assert.ok(serialized.approvalContext);
  assert.ok(serialized.runtimeControl);
});

// ============================================================================
// Field Ownership Tests
// ============================================================================

test('TaskEnvelopeV2: runtimeControl identifies executor correctly', () => {
  const envelope = createTaskEnvelopeV2({
    ...makeMinimalInput(),
    runtimeControl: { executor: 'deerflow', degraded: false, runtimeName: 'deerflow-local' },
  });

  assert.equal(envelope.runtimeControl.executor, 'deerflow');
  assert.equal(envelope.runtimeControl.degraded, false);
  assert.equal(envelope.runtimeControl.runtimeName, 'deerflow-local');
});

test('TaskEnvelopeV2: memoryContext layerHints support all three layers', () => {
  const envelope = createTaskEnvelopeV2({
    ...makeMinimalInput(),
    memoryContext: {
      profileExcerpt: 'context',
      layerHints: { preferL1: true, preferL2: true, preferL3: false },
    },
  });

  assert.equal(envelope.memoryContext.layerHints?.preferL1, true);
  assert.equal(envelope.memoryContext.layerHints?.preferL2, true);
  assert.equal(envelope.memoryContext.layerHints?.preferL3, false);
});
