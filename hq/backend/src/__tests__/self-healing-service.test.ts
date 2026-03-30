import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SelfHealingService,
  DEFAULT_SELF_HEALING_CONFIG,
  createSelfHealingService,
} from '../runtime/self-healing-service';
import type { HealingAttempt } from '../runtime/self-healing-service';
import type { Agent } from '../types';

// --- Helpers ---

function makeRetryAttempt(
  taskId: string,
  attemptNumber: number,
  overrides: Partial<HealingAttempt> = {},
): HealingAttempt {
  return {
    attemptNumber,
    taskId,
    stepId: 'step-1',
    assignmentId: 'assign-1',
    error: new Error('test error'),
    timestamp: new Date().toISOString(),
    strategy: 'retry',
    originalAgentId: 'agent-1',
    success: false,
    ...overrides,
  };
}

function makeReplaceAttempt(
  taskId: string,
  attemptNumber: number,
  overrides: Partial<HealingAttempt> = {},
): HealingAttempt {
  return {
    attemptNumber,
    taskId,
    stepId: 'step-1',
    assignmentId: 'assign-1',
    error: new Error('replacement error'),
    timestamp: new Date().toISOString(),
    strategy: 'replace_agent',
    originalAgentId: 'agent-1',
    replacementAgentId: 'agent-2',
    success: false,
    ...overrides,
  };
}

function makeMockAgent(id: string, department: string): Agent {
  return {
    id,
    filePath: `/agents/${id}.md`,
    department,
    frontmatter: {
      name: id,
      description: `Agent ${id} in ${department}`,
    },
    content: '',
    systemPrompt: '',
  };
}

// --- Tests ---

test('shouldRetry returns true for timeout errors', () => {
  const service = new SelfHealingService();
  assert.equal(service.shouldRetry('task-1', new Error('operation timed out')), true);
});

test('shouldRetry returns true for network errors', () => {
  const service = new SelfHealingService();
  assert.equal(service.shouldRetry('task-1', new Error('network connection lost')), true);
});

test('shouldRetry returns true for unavailable errors', () => {
  const service = new SelfHealingService();
  assert.equal(service.shouldRetry('task-1', new Error('service unavailable')), true);
});

test('shouldRetry returns false for non-retryable errors', () => {
  const service = new SelfHealingService();
  assert.equal(service.shouldRetry('task-1', new Error('permission denied')), false);
});

test('shouldRetry returns false for generic errors without keywords', () => {
  const service = new SelfHealingService();
  assert.equal(service.shouldRetry('task-1', new Error('something went wrong')), false);
});

test('shouldRetry respects maxRetryAttempts', () => {
  const service = new SelfHealingService({ maxRetries: 2 });
  const taskId = 'task-limited';
  const error = new Error('timed out');

  // First check - no attempts yet
  assert.equal(service.shouldRetry(taskId, error), true);
  service.recordAttempt(makeRetryAttempt(taskId, 1));

  // Second check - 1 attempt, still within maxRetries=2
  assert.equal(service.shouldRetry(taskId, error), true);
  service.recordAttempt(makeRetryAttempt(taskId, 2));

  // Third check - 2 attempts, exceeds maxRetries=2
  assert.equal(service.shouldRetry(taskId, error), false);
});

test('shouldReplaceAgent returns true after max retries exhausted', () => {
  const service = new SelfHealingService({ maxRetries: 2, enableAgentReplacement: true });
  const taskId = 'task-replace';

  service.recordAttempt(makeRetryAttempt(taskId, 1));
  service.recordAttempt(makeRetryAttempt(taskId, 2));

  assert.equal(service.shouldReplaceAgent(taskId), true);
});

test('shouldReplaceAgent returns false when retries not exhausted', () => {
  const service = new SelfHealingService({ maxRetries: 3, enableAgentReplacement: true });
  const taskId = 'task-noreplace';

  service.recordAttempt(makeRetryAttempt(taskId, 1));

  assert.equal(service.shouldReplaceAgent(taskId), false);
});

test('shouldReplaceAgent returns false when replacement disabled', () => {
  const service = new SelfHealingService({ maxRetries: 1, enableAgentReplacement: false });
  const taskId = 'task-disabled';

  service.recordAttempt(makeRetryAttempt(taskId, 1));
  service.recordAttempt(makeRetryAttempt(taskId, 2));

  assert.equal(service.shouldReplaceAgent(taskId), false);
});

test('shouldReplaceAgent returns false when no retry attempts exist', () => {
  const service = new SelfHealingService({ maxRetries: 1, enableAgentReplacement: true });
  const taskId = 'task-noretries';

  // Record only replace_agent attempts, no retry attempts
  service.recordAttempt(makeReplaceAttempt(taskId, 1));
  service.recordAttempt(makeReplaceAttempt(taskId, 2));

  // shouldReplaceAgent requires at least one retry attempt in history
  assert.equal(service.shouldReplaceAgent(taskId), false);
});

test('selectReplacementAgent returns different agent', () => {
  const mockAgents = [
    makeMockAgent('agent-1', 'engineering'),
    makeMockAgent('agent-2', 'engineering'),
  ];
  const mockScanner = {
    getAllAgents: () => mockAgents,
    scanAgentDirectories: () => Promise.resolve([]),
  } as any;

  const service = new SelfHealingService({}, mockScanner);
  const replacement = service.selectReplacementAgent('agent-1', 'task-replace', 'step-1');

  assert.ok(replacement);
  assert.notEqual(replacement, 'agent-1');
  assert.equal(replacement, 'agent-2');
});

test('selectReplacementAgent returns null when no scanner provided', () => {
  const service = new SelfHealingService({});
  const result = service.selectReplacementAgent('agent-1', 'task-1', 'step-1');
  assert.equal(result, null);
});

test('selectReplacementAgent returns null when failed agent not found', () => {
  const mockAgents = [makeMockAgent('agent-2', 'engineering')];
  const mockScanner = {
    getAllAgents: () => mockAgents,
    scanAgentDirectories: () => Promise.resolve([]),
  } as any;

  const service = new SelfHealingService({}, mockScanner);
  const result = service.selectReplacementAgent('agent-nonexistent', 'task-1', 'step-1');

  assert.equal(result, null);
});

test('selectReplacementAgent returns null when no same-department candidates', () => {
  const mockAgents = [
    makeMockAgent('agent-1', 'engineering'),
    makeMockAgent('agent-2', 'marketing'),
  ];
  const mockScanner = {
    getAllAgents: () => mockAgents,
    scanAgentDirectories: () => Promise.resolve([]),
  } as any;

  const service = new SelfHealingService({}, mockScanner);
  const result = service.selectReplacementAgent('agent-1', 'task-1', 'step-1');

  assert.equal(result, null);
});

test('selectReplacementAgent excludes previously used agents', () => {
  const mockAgents = [
    makeMockAgent('agent-1', 'engineering'),
    makeMockAgent('agent-2', 'engineering'),
    makeMockAgent('agent-3', 'engineering'),
  ];
  const mockScanner = {
    getAllAgents: () => mockAgents,
    scanAgentDirectories: () => Promise.resolve([]),
  } as any;

  const service = new SelfHealingService({}, mockScanner);
  const taskId = 'task-exclude';

  // agent-1 failed (retry), agent-2 was tried as replacement
  service.recordAttempt(makeRetryAttempt(taskId, 1));
  service.recordAttempt(makeReplaceAttempt(taskId, 2));

  // Should pick agent-3 (not agent-1 or agent-2)
  const replacement = service.selectReplacementAgent('agent-1', taskId, 'step-1');
  assert.equal(replacement, 'agent-3');
});

test('createCheckpoint stores workflow state', () => {
  const service = new SelfHealingService();

  const checkpoint = service.createCheckpoint('plan-1', 'task-1', {
    completedSteps: ['step-a', 'step-b'],
    currentStep: 'step-c',
  });

  assert.equal(checkpoint.workflowPlanId, 'plan-1');
  assert.equal(checkpoint.taskId, 'task-1');
  assert.deepEqual(checkpoint.completedSteps, ['step-a', 'step-b']);
  assert.equal(checkpoint.currentStep, 'step-c');
  assert.ok(checkpoint.timestamp);
  assert.ok(checkpoint.context);
});

test('createCheckpoint stores context data', () => {
  const service = new SelfHealingService();

  const checkpoint = service.createCheckpoint('plan-2', 'task-2', {
    completedSteps: ['step-x'],
  });

  assert.ok(checkpoint.context);
  assert.deepEqual(checkpoint.context.completedSteps, ['step-x']);
  assert.equal(checkpoint.currentStep, undefined);
});

test('getAttemptHistory returns empty for unknown workflow', () => {
  const service = new SelfHealingService();
  const attempts = service.getAttempts('nonexistent-task');
  assert.deepEqual(attempts, []);
});

test('recordAttempt stores attempt data', () => {
  const service = new SelfHealingService();

  service.recordAttempt(makeRetryAttempt('task-record', 1));

  const attempts = service.getAttempts('task-record');
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].taskId, 'task-record');
  assert.equal(attempts[0].strategy, 'retry');
  assert.equal(attempts[0].attemptNumber, 1);
});

test('recordAttempt accumulates multiple attempts', () => {
  const service = new SelfHealingService();

  service.recordAttempt({ ...makeRetryAttempt('task-acc', 1), success: false });
  service.recordAttempt({ ...makeRetryAttempt('task-acc', 2), success: true });

  const attempts = service.getAttempts('task-acc');
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].success, true);
});

test('getLatestAttempt returns most recent attempt', () => {
  const service = new SelfHealingService();

  service.recordAttempt({ ...makeRetryAttempt('task-latest', 1), outputSummary: 'first' });
  service.recordAttempt({ ...makeRetryAttempt('task-latest', 2), outputSummary: 'second' });

  const latest = service.getLatestAttempt('task-latest');
  assert.ok(latest);
  assert.equal(latest.outputSummary, 'second');
});

test('getLatestAttempt returns null for unknown task', () => {
  const service = new SelfHealingService();
  assert.equal(service.getLatestAttempt('nonexistent'), null);
});

test('clearAttempts removes attempts for a task', () => {
  const service = new SelfHealingService();
  service.recordAttempt(makeRetryAttempt('task-clear', 1));
  service.clearAttempts('task-clear');

  assert.deepEqual(service.getAttempts('task-clear'), []);
});

test('getConfig returns current config', () => {
  const service = new SelfHealingService({ maxRetries: 5 });
  const config = service.getConfig();

  assert.equal(config.maxRetries, 5);
  assert.equal(config.retryDelayMs, DEFAULT_SELF_HEALING_CONFIG.retryDelayMs);
});

test('updateConfig modifies config', () => {
  const service = new SelfHealingService();
  service.updateConfig({ maxRetries: 10 });

  assert.equal(service.getConfig().maxRetries, 10);
});

test('generateHealingSummary returns message when no attempts', () => {
  const service = new SelfHealingService();
  const summary = service.generateHealingSummary('unknown-task');
  assert.equal(summary, 'No healing attempts recorded.');
});

test('generateHealingSummary produces summary with attempts', () => {
  const service = new SelfHealingService();
  service.recordAttempt(makeRetryAttempt('task-sum', 1));
  service.recordAttempt({ ...makeRetryAttempt('task-sum', 2), success: true });

  const summary = service.generateHealingSummary('task-sum');

  assert.match(summary, /Total attempts: 2/);
  assert.match(summary, /Successful: 1/);
  assert.match(summary, /retry \(2\)/);
});

test('generateHealingSummary includes replacement info when applicable', () => {
  const service = new SelfHealingService();
  service.recordAttempt(makeReplaceAttempt('task-sum-replace', 1));

  const summary = service.generateHealingSummary('task-sum-replace');
  assert.match(summary, /Agent replacements: 1/);
});

test('createSelfHealingService factory creates instance', () => {
  const service = createSelfHealingService({ maxRetries: 7 });
  assert.ok(service);
  assert.equal(service.getConfig().maxRetries, 7);
});

test('constructor applies default config when no config provided', () => {
  const service = new SelfHealingService();
  const config = service.getConfig();

  assert.equal(config.maxRetries, DEFAULT_SELF_HEALING_CONFIG.maxRetries);
  assert.equal(config.retryDelayMs, DEFAULT_SELF_HEALING_CONFIG.retryDelayMs);
  assert.equal(config.enableAgentReplacement, DEFAULT_SELF_HEALING_CONFIG.enableAgentReplacement);
  assert.equal(config.enableCheckpointRecovery, DEFAULT_SELF_HEALING_CONFIG.enableCheckpointRecovery);
});
