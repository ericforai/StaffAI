import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import { join } from 'node:path';
import { TaskController, type ExecutionState, type PauseOptions } from '../runtime/task-controller';
import { ExecutionStateStore } from '../runtime/execution-store';

function createTempDir(): string {
  return mkdtempSync(join(os.tmpdir(), 'task-controller-'));
}

test('TaskController: pause execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const initialState: ExecutionState = {
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
    };

    await store.save(initialState);
    await controller.pause('exec-1');

    const pausedState = await store.load('exec-1');
    assert.ok(pausedState);
    assert.equal(pausedState.status, 'paused');
    assert.ok(pausedState.pausedAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: resume paused execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const pausedState: ExecutionState = {
      executionId: 'exec-1',
      status: 'paused',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
      pausedAt: new Date().toISOString(),
    };

    await store.save(pausedState);
    await controller.resume('exec-1');

    const resumedState = await store.load('exec-1');
    assert.ok(resumedState);
    assert.equal(resumedState.status, 'running');
    assert.ok(resumedState.resumedAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: cancel running execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const runningState: ExecutionState = {
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
    };

    await store.save(runningState);
    await controller.cancel('exec-1');

    const cancelledState = await store.load('exec-1');
    assert.ok(cancelledState);
    assert.equal(cancelledState.status, 'cancelled');
    assert.ok(cancelledState.cancelledAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: cancel paused execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const pausedState: ExecutionState = {
      executionId: 'exec-1',
      status: 'paused',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
      pausedAt: new Date().toISOString(),
    };

    await store.save(pausedState);
    await controller.cancel('exec-1');

    const cancelledState = await store.load('exec-1');
    assert.ok(cancelledState);
    assert.equal(cancelledState.status, 'cancelled');
    assert.ok(cancelledState.cancelledAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: pause already paused execution is idempotent', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const pausedState: ExecutionState = {
      executionId: 'exec-1',
      status: 'paused',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
      pausedAt: new Date(Date.now() - 1000).toISOString(),
    };

    await store.save(pausedState);
    await controller.pause('exec-1');

    const state = await store.load('exec-1');
    assert.ok(state);
    assert.equal(state.status, 'paused');
    assert.equal(state.pausedAt, pausedState.pausedAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: pause completed execution throws error', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const completedState: ExecutionState = {
      executionId: 'exec-1',
      status: 'completed',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await store.save(completedState);

    await assert.rejects(
      async () => controller.pause('exec-1'),
      (error: Error) => {
        assert.equal(error.message, 'Cannot pause execution with status: completed');
        return true;
      }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: resume running execution is no-op', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const runningState: ExecutionState = {
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
    };

    await store.save(runningState);
    await controller.resume('exec-1');

    const state = await store.load('exec-1');
    assert.ok(state);
    assert.equal(state.status, 'running');
    assert.equal(state.resumedAt, undefined);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: resume cancelled execution throws error', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const cancelledState: ExecutionState = {
      executionId: 'exec-1',
      status: 'cancelled',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
      cancelledAt: new Date().toISOString(),
    };

    await store.save(cancelledState);

    await assert.rejects(
      async () => controller.resume('exec-1'),
      (error: Error) => {
        assert.equal(error.message, 'Cannot resume execution with status: cancelled');
        return true;
      }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: cancel already cancelled execution is idempotent', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const cancelledState: ExecutionState = {
      executionId: 'exec-1',
      status: 'cancelled',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
      cancelledAt: new Date(Date.now() - 1000).toISOString(),
    };

    await store.save(cancelledState);
    await controller.cancel('exec-1');

    const state = await store.load('exec-1');
    assert.ok(state);
    assert.equal(state.status, 'cancelled');
    assert.equal(state.cancelledAt, cancelledState.cancelledAt);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: getStatus returns execution state', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const state: ExecutionState = {
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
    };

    await store.save(state);

    const status = await controller.getStatus('exec-1');
    assert.ok(status);
    assert.equal(status.executionId, 'exec-1');
    assert.equal(status.status, 'running');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: getStatus returns null for non-existent execution', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const status = await controller.getStatus('non-existent');
    assert.equal(status, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: pause with checkpoint data', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const initialState: ExecutionState = {
      executionId: 'exec-1',
      status: 'running',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
    };

    await store.save(initialState);

    const checkpointData = {
      currentStep: 'step-2',
      completedSteps: ['step-1', 'step-0'],
      context: { progress: 50 },
    };

    const options: PauseOptions = { checkpointData };
    await controller.pause('exec-1', options);

    const pausedState = await store.load('exec-1');
    assert.ok(pausedState);
    assert.equal(pausedState.status, 'paused');
    assert.deepEqual(pausedState.checkpointData, checkpointData);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: pause non-existent execution throws error', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    await assert.rejects(
      async () => controller.pause('non-existent'),
      (error: Error) => {
        assert.equal(error.message, 'Execution not found: non-existent');
        return true;
      }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: resume non-existent execution throws error', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    await assert.rejects(
      async () => controller.resume('non-existent'),
      (error: Error) => {
        assert.equal(error.message, 'Execution not found: non-existent');
        return true;
      }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: cancel non-existent execution throws error', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    await assert.rejects(
      async () => controller.cancel('non-existent'),
      (error: Error) => {
        assert.equal(error.message, 'Execution not found: non-existent');
        return true;
      }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TaskController: cancel failed execution is idempotent', async () => {
  const tempDir = createTempDir();

  try {
    const store = new ExecutionStateStore(tempDir);
    const controller = new TaskController(store);

    const failedState: ExecutionState = {
      executionId: 'exec-1',
      status: 'failed',
      taskId: 'task-1',
      executor: 'claude',
      startedAt: new Date().toISOString(),
    };

    await store.save(failedState);
    await controller.cancel('exec-1');

    const state = await store.load('exec-1');
    assert.ok(state);
    assert.equal(state.status, 'failed');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
