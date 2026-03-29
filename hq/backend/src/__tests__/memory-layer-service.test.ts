/**
 * Memory Layer Service Tests
 *
 * Tests for L1/L2/L3 memory layer load and writeback.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryLayerService } from '../orchestration/memory-layer-service';
import { DEFAULT_LOAD_POLICY, DEFAULT_WRITEBACK_POLICY } from '../shared/memory-layer-types';
import type { MemoryEntry, MemoryLayer } from '../shared/memory-layer-types';

// ============================================================================
// Construction Tests
// ============================================================================

test('MemoryLayerService: constructs with defaults', () => {
  const service = new MemoryLayerService();
  assert.ok(service);
});

// ============================================================================
// Writeback Tests
// ============================================================================

test('MemoryLayerService.writeback: writes summary to L2 by default', async () => {
  const service = new MemoryLayerService();
  const entries = await service.writeback('task-1', 'Task completed successfully');

  assert.equal(entries.length, 1);
  assert.equal(entries[0].layer, 'L2');
  assert.equal(entries[0].category, 'execution_result');
  assert.equal(entries[0].sourceTaskId, 'task-1');
});

test('MemoryLayerService.writeback: writes facts alongside summary', async () => {
  const service = new MemoryLayerService();
  const entries = await service.writeback('task-2', 'Analyzed code', {
    facts: ['Uses React hooks', 'TypeScript strict mode'],
  });

  assert.equal(entries.length, 3);
  assert.equal(entries[0].category, 'execution_result');
  assert.equal(entries[1].category, 'learned_fact');
  assert.equal(entries[1].content, 'Uses React hooks');
  assert.equal(entries[2].content, 'TypeScript strict mode');
});

test('MemoryLayerService.writeback: writes to specified layer', async () => {
  const service = new MemoryLayerService();
  const entries = await service.writeback('task-3', 'Org knowledge', {
    targetLayer: 'L3',
  });

  assert.equal(entries[0].layer, 'L3');
});

test('MemoryLayerService.writeback: respects maxEntries limit', async () => {
  const service = new MemoryLayerService({
    writebackPolicy: { ...DEFAULT_WRITEBACK_POLICY, maxEntries: 2 },
  });

  const entries = await service.writeback('task-4', 'Summary', {
    facts: ['fact1', 'fact2', 'fact3'],
  });

  // maxEntries=2 means summary + 1 fact = 2 entries
  assert.equal(entries.length, 2);
});

// ============================================================================
// Load Tests
// ============================================================================

test('MemoryLayerService.loadMemory: returns empty when no entries exist', async () => {
  const service = new MemoryLayerService();
  const result = await service.loadMemory('task-1');

  assert.equal(result.entries.length, 0);
  assert.equal(result.excerpts.length, 0);
  assert.equal(result.totalChars, 0);
});

test('MemoryLayerService: writeback then load round-trip', async () => {
  const service = new MemoryLayerService();

  // Write some data
  await service.writeback('task-1', 'React patterns: use hooks');
  await service.writeback('task-2', 'Node.js async patterns');

  // Load it back
  const result = await service.loadMemory('task-1');

  assert.ok(result.entries.length >= 1);
  assert.ok(result.excerpts.length >= 1);
  assert.ok(result.totalChars > 0);
});

test('MemoryLayerService: respects layer selection in load policy', async () => {
  const service = new MemoryLayerService({
    loadPolicy: { ...DEFAULT_LOAD_POLICY, layers: ['L1'] },
  });

  // Write to L2
  await service.writeback('task-1', 'Project knowledge');

  // Load only from L1 - should find nothing
  const result = await service.loadMemory('task-1');
  assert.equal(result.entries.length, 0);
});

// ============================================================================
// Layer Definition Tests
// ============================================================================

test('MemoryLayerService: L1 and L2 are usable in a real task path', async () => {
  const service = new MemoryLayerService({
    loadPolicy: { ...DEFAULT_LOAD_POLICY, layers: ['L1', 'L2'] },
  });

  // Write to L1
  const l1Entries = await service.writeback('task-1', 'Session context', {
    targetLayer: 'L1',
  });

  // Write to L2
  const l2Entries = await service.writeback('task-1', 'Project knowledge', {
    targetLayer: 'L2',
  });

  assert.equal(l1Entries[0].layer, 'L1');
  assert.equal(l2Entries[0].layer, 'L2');

  // Load both layers
  const loaded = await service.loadMemory('task-1');
  assert.ok(loaded.entries.length >= 2, 'Should have entries from both L1 and L2');
});
