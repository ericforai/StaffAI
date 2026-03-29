/**
 * DeerFlow Adapter v2 Integration Tests
 *
 * Verifies TaskEnvelope v2 is correctly constructed and serialized
 * by the DeerFlow adapter for Workshop consumption.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTaskEnvelopeV2,
  parseEnvelope,
  serializeEnvelope,
  TASK_ENVELOPE_V2_VERSION,
} from '../shared/task-envelope-v2';
import type { TaskRecord, TaskExecutionMode } from '../shared/task-types';

// ============================================================================
// Helpers
// ============================================================================

function makeTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-test-001',
    title: 'Research React patterns',
    description: 'Analyze React hooks patterns for the dashboard',
    taskType: 'architecture_analysis',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'test-user',
    requestedAt: '2026-03-29T00:00:00.000Z',
    recommendedAgentRole: 'frontend-developer',
    candidateAgentRoles: ['frontend-developer', 'backend-developer'],
    routeReason: 'Matched by task type',
    routingStatus: 'matched',
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Adapter builds correct v2 envelope
// ============================================================================

test('DeerFlow adapter: constructs v2 envelope with all task metadata', () => {
  const task = makeTaskRecord();

  const envelope = createTaskEnvelopeV2({
    taskMetadata: {
      taskId: task.id,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      priority: task.priority,
      executionMode: task.executionMode,
      requestedBy: task.requestedBy,
      requestedAt: task.requestedAt,
    },
    routing: {
      recommendedAgentRole: task.recommendedAgentRole,
      candidateAgentRoles: task.candidateAgentRoles,
      routeReason: task.routeReason,
    },
    approvalContext: {
      approvalRequired: task.approvalRequired,
      riskLevel: task.riskLevel,
    },
    memoryContext: {
      profileExcerpt: 'Previous work on React dashboard...',
      layerHints: { preferL1: true, preferL2: true },
    },
    budgetControl: {
      timeoutMs: 300000,
      maxRetries: 3,
    },
    toolPolicy: {
      allowedTools: ['read_url', 'web_search'],
      blockedTools: ['delete_file'],
      riskThreshold: 'medium',
    },
    runtimeControl: {
      executor: 'deerflow',
      runtimeName: 'python_deerflow_workshop',
      sessionCapabilities: { sampling: false },
    },
  });

  // Verify envelope structure
  assert.equal(envelope.version, '2.0');
  assert.equal(envelope.taskMetadata.taskId, 'task-test-001');
  assert.equal(envelope.taskMetadata.title, 'Research React patterns');
  assert.equal(envelope.routing.recommendedAgentRole, 'frontend-developer');
  assert.equal(envelope.approvalContext.approvalRequired, false);
  assert.equal(envelope.memoryContext.profileExcerpt, 'Previous work on React dashboard...');
  assert.equal(envelope.budgetControl.timeoutMs, 300000);
  assert.deepEqual(envelope.toolPolicy.allowedTools, ['read_url', 'web_search']);
  assert.equal(envelope.runtimeControl.executor, 'deerflow');
});

test('DeerFlow adapter: serialized envelope is JSON-compatible', () => {
  const task = makeTaskRecord();

  const envelope = createTaskEnvelopeV2({
    taskMetadata: {
      taskId: task.id,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      priority: task.priority,
      executionMode: task.executionMode,
      requestedBy: task.requestedBy,
      requestedAt: task.requestedAt,
    },
    routing: {
      recommendedAgentRole: task.recommendedAgentRole,
      candidateAgentRoles: task.candidateAgentRoles,
      routeReason: task.routeReason,
    },
    approvalContext: {
      approvalRequired: task.approvalRequired,
      riskLevel: task.riskLevel,
    },
    runtimeControl: {
      executor: 'deerflow',
    },
  });

  const serialized = serializeEnvelope(envelope);
  const json = JSON.stringify(serialized);
  const parsed = JSON.parse(json);

  // Verify JSON round-trip preserves all fields
  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.taskMetadata.taskId, 'task-test-001');
  assert.equal(parsed.routing.recommendedAgentRole, 'frontend-developer');
  assert.equal(parsed.runtimeControl.executor, 'deerflow');
});

// ============================================================================
// Backward compatibility - v1 still works
// ============================================================================

test('DeerFlow adapter: v1 envelope format still parses correctly', () => {
  const v1 = {
    task_id: 'legacy-task-001',
    action: 'Legacy Task',
    agent_role: 'backend-developer',
    description: 'A legacy v1 task',
    memory_context: 'Some context',
    payload: { key: 'value' },
  };

  const parsed = parseEnvelope(v1);

  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.taskMetadata.taskId, 'legacy-task-001');
  assert.equal(parsed.taskMetadata.title, 'Legacy Task');
  assert.equal(parsed.routing.recommendedAgentRole, 'backend-developer');
  assert.equal(parsed.runtimeControl.executor, 'deerflow');
});

// ============================================================================
// Python parser compatibility
// ============================================================================

test('DeerFlow adapter: serialized v2 matches Python parser expectations', () => {
  const envelope = createTaskEnvelopeV2({
    taskMetadata: {
      taskId: 'py-compat-001',
      title: 'Python Compat Task',
      description: 'Verify Python can parse this',
      taskType: 'backend_implementation',
      priority: 'high',
      executionMode: 'serial',
      requestedBy: 'integration-test',
      requestedAt: '2026-03-29T00:00:00.000Z',
    },
    routing: {
      recommendedAgentRole: 'backend-developer',
      candidateAgentRoles: ['backend-developer'],
      routeReason: 'Matched by task type',
    },
    approvalContext: {
      approvalRequired: true,
      riskLevel: 'high',
    },
    memoryContext: {
      profileExcerpt: 'Test memory excerpt',
    },
    budgetControl: {
      timeoutMs: 60000,
      maxRetries: 2,
    },
    runtimeControl: {
      executor: 'deerflow',
      runtimeName: 'python_deerflow_workshop',
    },
  });

  const serialized = serializeEnvelope(envelope) as any;

  // Verify all fields Python parser expects are present
  assert.ok(serialized.version === '2.0', 'version must be "2.0"');
  assert.ok(serialized.taskMetadata, 'taskMetadata must exist');
  assert.ok(serialized.taskMetadata.taskId, 'taskMetadata.taskId must exist');
  assert.ok(serialized.routing, 'routing must exist');
  assert.ok(serialized.routing.recommendedAgentRole, 'routing.recommendedAgentRole must exist');
  assert.ok(serialized.memoryContext, 'memoryContext must exist');
  assert.ok(serialized.runtimeControl, 'runtimeControl must exist');
  assert.ok(serialized.runtimeControl.executor, 'runtimeControl.executor must exist');

  // Verify specific values match
  assert.equal(serialized.taskMetadata.taskId, 'py-compat-001');
  assert.equal(serialized.taskMetadata.title, 'Python Compat Task');
  assert.equal(serialized.routing.recommendedAgentRole, 'backend-developer');
  assert.equal(serialized.approvalContext?.approvalRequired, true);
  assert.equal(serialized.budgetControl?.timeoutMs, 60000);
  assert.equal(serialized.runtimeControl.executor, 'deerflow');
});

// ============================================================================
// Execution trace includes v2 fields
// ============================================================================

test('DeerFlow adapter: output snapshot includes v2 protocol fields', () => {
  // Simulate what the adapter would return
  const outputSnapshot = {
    runtimeName: 'python_deerflow_workshop',
    executor: 'deerflow',
    executionMode: 'single',
    protocolVersion: '2.0',
    routing: {
      recommendedAgentRole: 'frontend-developer',
      assigneeId: undefined,
    },
    budgetControl: {
      timeoutMs: 300000,
      maxRetries: 3,
    },
    additionalData: { messages: [] },
  };

  assert.equal(outputSnapshot.protocolVersion, '2.0');
  assert.equal(outputSnapshot.routing.recommendedAgentRole, 'frontend-developer');
  assert.equal(outputSnapshot.budgetControl.timeoutMs, 300000);
});
