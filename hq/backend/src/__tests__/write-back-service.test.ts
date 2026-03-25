/**
 * Write-Back Service Tests
 *
 * TDD tests for Phase 4.7 write-back strategy:
 * - Execution summary write-back
 * - Decision record write-back
 * - Classification logic (success/failure/partial)
 * - File generation and path management
 * - Integration with existing memory-retriever
 * - Directory auto-creation
 * - Backward compatibility
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WriteBackService,
  createWriteBackService,
  classifyExecutionOutcome,
  generateExecutionFilename,
  generateDecisionFilename,
  extractSuccessFactors,
  extractIssuesEncountered,
  determineStorageCategory,
} from '../memory/write-back-service';
import {
  serializeFrontmatter,
  generateTaskSummaryMarkdown,
  generateDecisionRecordMarkdown,
} from '../memory/write-back-templates';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';
import { createMemoryLayout } from '../memory/memory-layout';
import type {
  WriteBackResult,
  WriteBackConfig,
  WriteBackFrontmatter,
  ExecutionOutcome,
  ExecutionSummaryData,
  DecisionRecordData,
} from '../memory/write-back-types';

/**
 * Test helpers
 */

function createTempEnvironment(): {
  tempDir: string;
  memoryRootDir: string;
  cleanup: () => void;
} {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-back-test-'));
  const memoryRootDir = tempDir;

  const cleanup = () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };

  return { tempDir, memoryRootDir, cleanup };
}

function createMockTask(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    id: 'task-123',
    title: 'Implement user authentication',
    description: 'Add login and signup functionality with JWT tokens',
    taskType: 'backend_implementation',
    priority: 'high',
    status: 'running',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'medium',
    requestedBy: 'user-1',
    requestedAt: '2026-03-25T10:00:00.000Z',
    recommendedAgentRole: 'engineering/backend-developer',
    candidateAgentRoles: ['engineering/backend-developer'],
    routeReason: 'Backend implementation task',
    routingStatus: 'matched',
    createdAt: '2026-03-25T10:00:00.000Z',
    updatedAt: '2026-03-25T10:00:00.000Z',
    ...overrides,
  };
}

function createMockExecution(overrides?: Partial<ExecutionLifecycleRecord>): ExecutionLifecycleRecord {
  return {
    id: 'exec-456',
    taskId: 'task-123',
    status: 'completed',
    executor: 'claude',
    runtimeName: 'claude-sonnet-4.6',
    degraded: false,
    startedAt: '2026-03-25T10:01:00.000Z',
    completedAt: '2026-03-25T10:05:00.000Z',
    endedAt: '2026-03-25T10:05:00.000Z',
    outputSummary: 'Successfully implemented JWT authentication with refresh tokens',
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 30000,
    ...overrides,
  };
}

/**
 * Classification Logic Tests
 */

test('classifyExecutionOutcome - returns success for completed execution', () => {
  const execution = createMockExecution({
    status: 'completed',
    outputSummary: 'Task completed successfully',
  });

  const outcome = classifyExecutionOutcome(execution);

  assert.equal(outcome, 'success');
});

test('classifyExecutionOutcome - returns failure for failed execution', () => {
  const execution = createMockExecution({
    status: 'failed',
    errorMessage: 'Connection timeout',
  });

  const outcome = classifyExecutionOutcome(execution);

  assert.equal(outcome, 'failure');
});

test('classifyExecutionOutcome - returns degraded for degraded execution', () => {
  const execution = createMockExecution({
    status: 'completed',
    degraded: true,
    outputSummary: 'Partial completion due to rate limiting',
  });

  const outcome = classifyExecutionOutcome(execution);

  assert.equal(outcome, 'degraded');
});

test('classifyExecutionOutcome - returns partial for completed with error message', () => {
  const execution = createMockExecution({
    status: 'completed',
    errorMessage: 'Completed with warnings',
    outputSummary: 'Main functionality works',
  });

  const outcome = classifyExecutionOutcome(execution);

  assert.equal(outcome, 'partial');
});

test('classifyExecutionOutcome - returns failure for unknown status', () => {
  const execution = createMockExecution({
    status: 'pending',
  });

  const outcome = classifyExecutionOutcome(execution);

  assert.equal(outcome, 'failure');
});

/**
 * Filename Generation Tests
 */

test('generateExecutionFilename - creates correct filename with outcome prefix', () => {
  const task = createMockTask();
  const execution = createMockExecution();
  const outcome: ExecutionOutcome = 'success';

  const filename = generateExecutionFilename(task, execution, outcome);

  assert.ok(filename.includes('2026-03-25'));
  assert.ok(filename.includes('success'));
  assert.ok(filename.includes(task.id));
  assert.ok(filename.endsWith('.md'));
});

test('generateExecutionFilename - sanitizes task title in filename', () => {
  const task = createMockTask({ title: 'Title with Special Characters!@#$%' });
  const execution = createMockExecution();
  const outcome: ExecutionOutcome = 'failure';

  const filename = generateExecutionFilename(task, execution, outcome);

  assert.ok(!filename.includes('!'));
  assert.ok(!filename.includes('@'));
  assert.ok(!filename.includes('#'));
  assert.ok(!filename.includes('$'));
  assert.ok(filename.includes('title-with-special-characters'));
});

test('generateDecisionFilename - creates correct filename with date prefix', () => {
  const decisionId = 'decision-abc';
  const title = 'Use JWT Authentication';

  const filename = generateDecisionFilename(decisionId, title);

  assert.ok(filename.includes('2026-03-25'));
  assert.ok(filename.includes('decision'));
  assert.ok(filename.includes(decisionId));
  assert.ok(filename.endsWith('.md'));
});

test('generateDecisionFilename - sanitizes title in filename', () => {
  const decisionId = 'decision-123';
  const title = 'Decision: With Multiple/Special Characters';

  const filename = generateDecisionFilename(decisionId, title);

  assert.ok(!filename.includes(':'));
  assert.ok(!filename.includes('/'));
  assert.ok(filename.includes('decision-with-multiple-special-characters'));
});

/**
 * Template Serialization Tests
 */

test('serializeFrontmatter - converts object to YAML frontmatter', () => {
  const frontmatter: Record<string, unknown> = {
    id: 'test-123',
    type: 'success',
    status: 'completed',
    startedAt: '2026-03-25T10:00:00.000Z',
    completedAt: '2026-03-25T10:05:00.000Z',
  };

  const result = serializeFrontmatter(frontmatter);

  assert.ok(result.startsWith('---'));
  assert.ok(result.endsWith('---'));
  assert.ok(result.includes('id: test-123'));
  assert.ok(result.includes('type: success'));
  assert.ok(result.includes('status: completed'));
});

test('serializeFrontmatter - handles array values', () => {
  const frontmatter: Record<string, unknown> = {
    id: 'test-123',
    type: 'task-summary',
    status: 'completed',
    startedAt: '2026-03-25T10:00:00.000Z',
    completedAt: '2026-03-25T10:05:00.000Z',
    tags: ['test', 'example', 'backend'],
  };

  const result = serializeFrontmatter(frontmatter);

  assert.ok(result.includes('- test'));
  assert.ok(result.includes('- example'));
  assert.ok(result.includes('- backend'));
});

test('serializeFrontmatter - handles empty object', () => {
  const frontmatter: Record<string, unknown> = {
    id: 'test',
    type: 'task-summary',
    status: 'pending',
    startedAt: '2026-03-25T10:00:00.000Z',
    completedAt: '2026-03-25T10:00:00.000Z',
  };

  const result = serializeFrontmatter(frontmatter);

  assert.equal(result, '---\nid: test\ntype: task-summary\nstatus: pending\nstartedAt: 2026-03-25T10:00:00.000Z\ncompletedAt: 2026-03-25T10:00:00.000Z\n---');
});

/**
 * Helper Functions Tests
 */

test('extractSuccessFactors - extracts positive indicators from execution', () => {
  const execution = createMockExecution({
    outputSummary: 'All tests passed and deployment was successful',
    retryCount: 0,
    degraded: false,
  });

  const factors = extractSuccessFactors(execution);

  assert.ok(factors.length > 0);
  assert.ok(factors.some((f) => f.includes('all tests passed')));
  assert.ok(factors.some((f) => f.includes('no retries')));
  assert.ok(factors.some((f) => f.includes('not degraded')));
});

test('extractIssuesEncountered - extracts error information', () => {
  const execution = createMockExecution({
    status: 'failed',
    errorMessage: 'Connection timeout',
    retryCount: 2,
    degraded: true,
  });

  const issues = extractIssuesEncountered(execution);

  assert.ok(issues.length > 0);
  assert.ok(issues.some((i) => i.includes('Connection timeout')));
  assert.ok(issues.some((i) => i.includes('retry')));
  assert.ok(issues.some((i) => i.includes('degraded')));
});

test('determineStorageCategory - returns successes for success outcome', () => {
  const config: WriteBackConfig = {
    memoryRootDir: '/test',
    enableSuccessFailureCategorization: true,
    enableDecisionRecords: true,
    retainLegacyTaskSummaries: true,
    markdownTemplateFormat: 'frontmatter',
  };

  const category = determineStorageCategory('success', config);

  assert.equal(category, 'successes');
});

test('determineStorageCategory - returns failures for failure outcome', () => {
  const config: WriteBackConfig = {
    memoryRootDir: '/test',
    enableSuccessFailureCategorization: true,
    enableDecisionRecords: true,
    retainLegacyTaskSummaries: true,
    markdownTemplateFormat: 'frontmatter',
  };

  const category = determineStorageCategory('failure', config);

  assert.equal(category, 'failures');
});

test('determineStorageCategory - returns task-summaries when categorization disabled', () => {
  const config: WriteBackConfig = {
    memoryRootDir: '/test',
    enableSuccessFailureCategorization: false,
    enableDecisionRecords: true,
    retainLegacyTaskSummaries: true,
    markdownTemplateFormat: 'frontmatter',
  };

  const category = determineStorageCategory('success', config);

  assert.equal(category, 'task-summaries');
});

/**
 * Markdown Generation Tests
 */

test('generateTaskSummaryMarkdown - includes all required sections', () => {
  const task = createMockTask();
  const execution = createMockExecution();

  const summaryData: ExecutionSummaryData = {
    task,
    execution,
    outcome: 'success',
    successFactors: ['Completed successfully'],
    issuesEncountered: [],
  };

  const frontmatter: WriteBackFrontmatter = {
    id: execution.id,
    type: 'success',
    executionId: execution.id,
    taskId: task.id,
    agentId: execution.executor,
    outcome: 'success',
    status: execution.status,
    startedAt: execution.startedAt || '',
    completedAt: execution.completedAt || '',
  };

  const markdown = generateTaskSummaryMarkdown(summaryData, frontmatter);

  assert.ok(markdown.includes('# ' + task.title));
  assert.ok(markdown.includes('## Task Description'));
  assert.ok(markdown.includes(task.description));
  assert.ok(markdown.includes('## Execution Details'));
  assert.ok(markdown.includes(execution.id));
  assert.ok(markdown.includes(execution.executor || 'unknown'));
  assert.ok(markdown.includes(execution.status));
  assert.ok(markdown.includes('## Result Summary'));
  assert.ok(markdown.includes(execution.outputSummary ?? ''));
});

test('generateDecisionRecordMarkdown - includes all required sections', () => {
  const decisionData: DecisionRecordData = {
    decisionId: 'decision-123',
    title: 'Use JWT Authentication',
    context: 'We need to implement authentication',
    decision: 'Use JWT tokens',
    rationale: 'Stateless and scalable',
    impact: 'Secure authentication without server-side sessions',
    alternatives: ['Session-based auth', 'OAuth2'],
    taskId: 'task-123',
    timestamp: '2026-03-25T10:00:00.000Z',
    tags: ['authentication', 'security'],
  };

  const markdown = generateDecisionRecordMarkdown(decisionData);

  assert.ok(markdown.includes('# Use JWT Authentication'));
  assert.ok(markdown.includes('## Context'));
  assert.ok(markdown.includes('We need to implement authentication'));
  assert.ok(markdown.includes('## Decision'));
  assert.ok(markdown.includes('Use JWT tokens'));
  assert.ok(markdown.includes('## Rationale'));
  assert.ok(markdown.includes('Stateless and scalable'));
  assert.ok(markdown.includes('## Impact'));
  assert.ok(markdown.includes('Secure authentication'));
});

/**
 * WriteBackService Class Tests
 */

test('WriteBackService - writes execution summary', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({ memoryRootDir });
    const task = createMockTask();
    const execution = createMockExecution();

    const result = service.writeExecutionSummary(task, execution);

    assert.equal(result.success, true);
    assert.equal(result.category, 'successes');
    assert.equal(result.filePath !== undefined, true);
    if (result.filePath) {
      assert.equal(fs.existsSync(result.filePath), true);

      const content = fs.readFileSync(result.filePath, 'utf-8');
      assert.ok(content.includes(task.title));
      assert.ok(content.includes(execution.id));
    }
  } finally {
    cleanup();
  }
});

test('WriteBackService - writes execution summary to failures for failed execution', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({ memoryRootDir });
    const task = createMockTask();
    const execution = createMockExecution({
      status: 'failed',
      errorMessage: 'Test failure',
    });

    const result = service.writeExecutionSummary(task, execution);

    assert.equal(result.success, true);
    assert.equal(result.category, 'failures');
    assert.equal(result.filePath !== undefined, true);
    if (result.filePath) {
      assert.ok(result.filePath.includes('failures'));
      assert.equal(fs.existsSync(result.filePath), true);
    }
  } finally {
    cleanup();
  }
});

test('WriteBackService - writes decision record', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({ memoryRootDir });
    const decisionData: DecisionRecordData = {
      decisionId: 'decision-123',
      title: 'Use TypeScript',
      context: 'Need type safety',
      decision: 'Adopt TypeScript',
      rationale: 'Better tooling and error detection',
      impact: 'Improved code quality',
      taskId: 'task-123',
      timestamp: new Date().toISOString(),
    };

    const result = service.writeDecisionRecord(decisionData);

    assert.equal(result.success, true);
    assert.equal(result.category, 'decisions');
    assert.equal(result.filePath !== undefined, true);
    if (result.filePath) {
      assert.equal(fs.existsSync(result.filePath), true);

      const content = fs.readFileSync(result.filePath, 'utf-8');
      assert.ok(content.includes('Use TypeScript'));
    }
  } finally {
    cleanup();
  }
});

test('WriteBackService - auto-creates knowledge/successes directory', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const layout = createMemoryLayout(memoryRootDir);
    const successesDir = path.join(layout.knowledgeDir, 'successes');
    assert.equal(fs.existsSync(successesDir), false);

    const service = createWriteBackService({ memoryRootDir });
    const task = createMockTask();
    const execution = createMockExecution();

    service.writeExecutionSummary(task, execution);

    assert.equal(fs.existsSync(successesDir), true);
  } finally {
    cleanup();
  }
});

test('WriteBackService - auto-creates decisions directory', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const layout = createMemoryLayout(memoryRootDir);
    assert.equal(fs.existsSync(layout.decisionsDir), false);

    const service = createWriteBackService({ memoryRootDir });
    const decisionData: DecisionRecordData = {
      decisionId: 'decision-789',
      title: 'Test Decision',
      context: 'Context',
      decision: 'Decision',
      rationale: 'Rationale',
      impact: 'Impact',
      timestamp: new Date().toISOString(),
    };

    service.writeDecisionRecord(decisionData);

    assert.equal(fs.existsSync(layout.decisionsDir), true);
  } finally {
    cleanup();
  }
});

/**
 * Integration Tests
 */

test('Integration - multiple writes create organized directory structure', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({ memoryRootDir });

    // Write multiple executions
    for (let i = 0; i < 3; i++) {
      const task = createMockTask({ id: `task-${i}`, title: `Task ${i}` });
      const execution = createMockExecution({ id: `exec-${i}` });
      service.writeExecutionSummary(task, execution);
    }

    // Write multiple decisions
    for (let i = 0; i < 2; i++) {
      const decisionData: DecisionRecordData = {
        decisionId: `decision-${i}`,
        title: `Decision ${i}`,
        context: 'Context',
        decision: 'Decision',
        rationale: 'Rationale',
        impact: 'Impact',
        timestamp: new Date().toISOString(),
      };
      service.writeDecisionRecord(decisionData);
    }

    const layout = createMemoryLayout(memoryRootDir);

    // Check successes directory
    const successesDir = path.join(layout.knowledgeDir, 'successes');
    assert.equal(fs.existsSync(successesDir), true);

    // Check decisions directory
    assert.equal(fs.existsSync(layout.decisionsDir), true);

    const successFiles = fs.readdirSync(successesDir);
    const decisionFiles = fs.readdirSync(layout.decisionsDir);

    assert.equal(successFiles.length, 3);
    assert.equal(decisionFiles.length, 2);
  } finally {
    cleanup();
  }
});

test('Integration - maintains backward compatibility with legacy summaries', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({
      memoryRootDir,
      retainLegacyTaskSummaries: true,
    });

    const task = createMockTask();
    const execution = createMockExecution();

    const result = service.writeExecutionSummary(task, execution);

    assert.equal(result.success, true);

    // Check that both new categorized and legacy files exist
    const layout = createMemoryLayout(memoryRootDir);

    // New categorized file
    if (result.filePath) {
      assert.equal(fs.existsSync(result.filePath), true);
    }

    // Legacy file
    assert.equal(fs.existsSync(layout.taskSummariesDir), true);
    const legacyFiles = fs.readdirSync(layout.taskSummariesDir);
    assert.ok(legacyFiles.length > 0);
    assert.ok(legacyFiles[0].includes(task.id));
  } finally {
    cleanup();
  }
});

/**
 * Edge Case Tests
 */

test('Edge Case - handles very long task titles', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const longTitle = 'A'.repeat(500);
    const task = createMockTask({ title: longTitle });
    const execution = createMockExecution();

    const service = createWriteBackService({ memoryRootDir });
    const result = service.writeExecutionSummary(task, execution);

    assert.equal(result.success, true);
    assert.equal(result.filePath !== undefined, true);
  } finally {
    cleanup();
  }
});

test('Edge Case - handles execution with unicode output', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const unicodeOutput = 'Output with emoji 🎉, Chinese 中文, and Arabic العربية';
    const execution = createMockExecution({
      outputSummary: unicodeOutput,
    });
    const task = createMockTask();

    const service = createWriteBackService({ memoryRootDir });
    const result = service.writeExecutionSummary(task, execution);

    assert.equal(result.success, true);
    assert.equal(result.filePath !== undefined, true);
    if (result.filePath) {
      const content = fs.readFileSync(result.filePath, 'utf-8');
      assert.ok(content.includes(unicodeOutput));
    }
  } finally {
    cleanup();
  }
});

test('Edge Case - decision record with unicode content', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const unicodeContent = 'Decision with emoji 🚀, Japanese 日本語, and symbols ★';
    const decisionData: DecisionRecordData = {
      decisionId: 'decision-unicode',
      title: 'Unicode Decision',
      context: unicodeContent,
      decision: unicodeContent,
      rationale: unicodeContent,
      impact: unicodeContent,
      timestamp: new Date().toISOString(),
    };

    const service = createWriteBackService({ memoryRootDir });
    const result = service.writeDecisionRecord(decisionData);

    assert.equal(result.success, true);
    assert.equal(result.filePath !== undefined, true);
    if (result.filePath) {
      const content = fs.readFileSync(result.filePath, 'utf-8');
      assert.ok(content.includes(unicodeContent));
    }
  } finally {
    cleanup();
  }
});

/**
 * Error Handling Tests
 */

test('Error Handling - returns detailed error on write failure', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({ memoryRootDir });
    const task = createMockTask();
    const execution = createMockExecution();

    // Make directory read-only to trigger error
    const layout = createMemoryLayout(memoryRootDir);
    const successesDir = path.join(layout.knowledgeDir, 'successes');
    fs.mkdirSync(successesDir, { recursive: true });
    fs.chmodSync(successesDir, 0o444);

    const result = service.writeExecutionSummary(task, execution);

    assert.equal(result.success, false);
    assert.ok(result.error !== undefined);
    assert.ok(typeof result.error === 'string');
  } finally {
    cleanup();
  }
});

test('Error Handling - decision records disabled returns error', () => {
  const { memoryRootDir, cleanup } = createTempEnvironment();

  try {
    const service = createWriteBackService({
      memoryRootDir,
      enableDecisionRecords: false,
    });

    const decisionData: DecisionRecordData = {
      decisionId: 'decision-test',
      title: 'Test',
      context: 'Context',
      decision: 'Decision',
      rationale: 'Rationale',
      impact: 'Impact',
      timestamp: new Date().toISOString(),
    };

    const result = service.writeDecisionRecord(decisionData);

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Decision records are not enabled'));
  } finally {
    cleanup();
  }
});
