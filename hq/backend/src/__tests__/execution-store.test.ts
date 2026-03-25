import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';
import { ExecutionStateStore, type ExecutionState } from '../runtime/execution-store';

function createTempDir(): string {
  return mkdtempSync(join(os.tmpdir(), 'execution-store-'));
}

function createMockExecutionState(overrides: Partial<ExecutionState> = {}): ExecutionState {
  return {
    executionId: overrides.executionId ?? 'test-execution-1',
    status: overrides.status ?? 'running',
    taskId: overrides.taskId ?? 'task-123',
    executor: overrides.executor ?? 'claude',
    startedAt: overrides.startedAt ?? new Date().toISOString(),
    pausedAt: overrides.pausedAt,
    resumedAt: overrides.resumedAt,
    checkpointData: overrides.checkpointData,
  };
}

test('ExecutionStateStore: save and load execution state', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state = createMockExecutionState();

    await store.save(state);

    const loaded = await store.load(state.executionId);
    assert.ok(loaded);
    assert.equal(loaded.executionId, state.executionId);
    assert.equal(loaded.status, state.status);
    assert.equal(loaded.taskId, state.taskId);
    assert.equal(loaded.executor, state.executor);
    assert.equal(loaded.startedAt, state.startedAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: load returns null for non-existent execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);

    const loaded = await store.load('non-existent-id');
    assert.equal(loaded, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: delete removes execution state', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state = createMockExecutionState();

    await store.save(state);
    const loadedBefore = await store.load(state.executionId);
    assert.ok(loadedBefore);

    await store.delete(state.executionId);

    const loadedAfter = await store.load(state.executionId);
    assert.equal(loadedAfter, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: update saves new state with same ID', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state = createMockExecutionState({ status: 'running' });

    await store.save(state);

    const updatedState = { ...state, status: 'paused' as const, pausedAt: new Date().toISOString() };
    await store.save(updatedState);

    const loaded = await store.load(state.executionId);
    assert.ok(loaded);
    assert.equal(loaded.status, 'paused');
    assert.ok(loaded.pausedAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: checkpoint data is persisted', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const checkpointData = {
      currentStep: 'step-1',
      completedSteps: ['step-0'],
      context: { key: 'value' },
    };
    const state = createMockExecutionState({ checkpointData });

    await store.save(state);

    const loaded = await store.load(state.executionId);
    assert.ok(loaded);
    assert.deepEqual(loaded.checkpointData, checkpointData);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: multiple executions are isolated', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state1 = createMockExecutionState({
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
    });
    const state2 = createMockExecutionState({
      executionId: 'exec-2',
      status: 'paused',
      taskId: 'task-2',
    });

    await store.save(state1);
    await store.save(state2);

    const loaded1 = await store.load('exec-1');
    const loaded2 = await store.load('exec-2');

    assert.ok(loaded1);
    assert.equal(loaded1.executionId, 'exec-1');
    assert.equal(loaded1.status, 'running');

    assert.ok(loaded2);
    assert.equal(loaded2.executionId, 'exec-2');
    assert.equal(loaded2.status, 'paused');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: listAll returns all saved states', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state1 = createMockExecutionState({
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
    });
    const state2 = createMockExecutionState({
      executionId: 'exec-2',
      status: 'paused',
      taskId: 'task-2',
    });

    await store.save(state1);
    await store.save(state2);

    const allStates = await store.listAll();
    assert.equal(allStates.length, 2);

    const ids = allStates.map((state: ExecutionState) => state.executionId).sort();
    assert.deepEqual(ids, ['exec-1', 'exec-2']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: findByTaskId returns executions for task', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state1 = createMockExecutionState({
      executionId: 'exec-1',
      taskId: 'task-1',
    });
    const state2 = createMockExecutionState({
      executionId: 'exec-2',
      taskId: 'task-1',
    });
    const state3 = createMockExecutionState({
      executionId: 'exec-3',
      taskId: 'task-2',
    });

    await store.save(state1);
    await store.save(state2);
    await store.save(state3);

    const task1Executions = await store.findByTaskId('task-1');
    assert.equal(task1Executions.length, 2);

    const ids = task1Executions.map((state: ExecutionState) => state.executionId).sort();
    assert.deepEqual(ids, ['exec-1', 'exec-2']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ExecutionStateStore: exists returns true for existing execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const state = createMockExecutionState();

    const existsBefore = await store.exists(state.executionId);
    assert.equal(existsBefore, false);

    await store.save(state);

    const existsAfter = await store.exists(state.executionId);
    assert.equal(existsAfter, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
