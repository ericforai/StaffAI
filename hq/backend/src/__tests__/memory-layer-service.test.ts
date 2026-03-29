/**
 * Memory Layer Service Tests
 *
 * Tests for the L1/L2/L3 memory hierarchy service
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createMemoryLayerService,
  type MemoryLayerService,
} from '../orchestration/memory-layer-service';
import { initializeAiDirectory } from '../memory/directory-initializer';
import type { TaskRecord } from '../shared/task-types';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';

function createMockTask(overrides?: Partial<TaskRecord>): TaskRecord {
  return {
    id: 'task-123',
    title: 'Implement API Gateway',
    description: 'Build rate limiting and authentication for the API gateway',
    taskType: 'general',
    priority: 'medium',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'user',
    requestedAt: new Date().toISOString(),
    recommendedAgentRole: 'backend-developer',
    candidateAgentRoles: ['backend-developer'],
    routeReason: 'test',
    routingStatus: 'manual_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockExecution(overrides?: Partial<ExecutionLifecycleRecord>): ExecutionLifecycleRecord {
  return {
    id: 'exec-1',
    taskId: 'task-123',
    status: 'completed',
    executor: 'claude',
    runtimeName: 'claude',
    degraded: false,
    retryCount: 0,
    startedAt: new Date().toISOString(),
    outputSummary: 'Rate limiting implemented with 100 req/s limit. Authentication using JWT.',
    ...overrides,
  };
}

test('MemoryLayerService: loadMemory returns context from L1+L2 layers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-layer-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  // Create some test content in L2 (project memory)
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'architecture.md'),
    '# Architecture\nMicroservices design pattern with API Gateway.\n',
    'utf8'
  );

  const service = createMemoryLayerService({ memoryRootDir });
  const task = createMockTask();

  const result = await service.loadMemory(task);

  assert.ok(result.context.length > 0);
  assert.ok(result.entries.length > 0);
  assert.equal(result.metadata.totalEntries, result.entries.length);
  assert.ok(result.metadata.entriesByLayer.L2 || result.metadata.entriesByLayer.L1);

  fs.rmSync(root, { recursive: true, force: true });
});

test('MemoryLayerService: loadMemory respects custom policy', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-layer-policy-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const service = createMemoryLayerService({ memoryRootDir });
  const task = createMockTask();

  const result = await service.loadMemory(task, {
    maxEntriesPerLayer: 2,
    maxContextChars: 500,
  });

  // Should have limited entries and context
  assert.ok(result.entries.length <= 4); // 2 layers * 2 entries
  assert.ok(result.context.length <= 600); // 500 + some margin

  fs.rmSync(root, { recursive: true, force: true });
});

test('MemoryLayerService: writeback writes execution summary to L2', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-layer-write-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const service = createMemoryLayerService({ memoryRootDir });
  const task = createMockTask();
  const execution = createMockExecution();

  const result = await service.writeback(task, execution);

  assert.equal(result.success, true);
  assert.ok(result.filePath);
  assert.ok(result.relativePath);
  assert.equal(result.layer, 'L2');

  // Verify file was created
  assert.ok(fs.existsSync(result.filePath!));

  fs.rmSync(root, { recursive: true, force: true });
});

test('MemoryLayerService: writeback handles failed executions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-layer-fail-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const service = createMemoryLayerService({ memoryRootDir });
  const task = createMockTask();
  const execution = createMockExecution({
    status: 'failed',
    errorMessage: 'Timeout after 30s',
  });

  const result = await service.writeback(task, execution);

  assert.equal(result.success, true);
  assert.equal(result.layer, 'L2');

  // Failed executions should go to failures subdirectory
  assert.ok(result.filePath?.includes('failures'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('MemoryLayerService: loadMemory with initialized memory returns template content', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-layer-empty-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  const service = createMemoryLayerService({ memoryRootDir });
  const task = createMockTask();

  const result = await service.loadMemory(task);

  // Memory initialization creates template files, so we get those
  // This is expected behavior - templates provide structure
  assert.ok(result.context.length > 0);
  assert.ok(result.entries.length > 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('MemoryLayerService: loadMemory uses task description for relevance', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-layer-relevance-'));
  const memoryRootDir = path.join(root, '.ai');

  initializeAiDirectory({ rootDir: root, force: false, templates: true });

  // Create relevant content
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'api-gateway.md'),
    '# API Gateway\nRate limiting and JWT authentication setup.\n',
    'utf8'
  );

  // Create irrelevant content
  fs.writeFileSync(
    path.join(memoryRootDir, 'notes', 'frontend.md'),
    '# Frontend\nReact component library.\n',
    'utf8'
  );

  const service = createMemoryLayerService({ memoryRootDir });
  const task = createMockTask({
    title: 'API Gateway Setup',
    description: 'Configure rate limiting and JWT authentication',
  });

  const result = await service.loadMemory(task);

  // Should find the relevant API gateway content
  assert.ok(result.context.length > 0);
  assert.ok(result.entries.some((e) => e.relativePath.includes('api-gateway')));

  fs.rmSync(root, { recursive: true, force: true });
});
