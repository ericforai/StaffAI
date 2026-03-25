import test from 'node:test';
import assert from 'node:assert/strict';
import { TestRunnerTool } from '../tools/test-runner-tool';

test('TestRunnerTool reports success when injected runner succeeds', async () => {
  const tool = new TestRunnerTool(async () => ({ stdout: 'all ok', stderr: '' }));
  const result = await tool.execute({}, { actorRole: 'reviewer' });
  assert.equal(result.error, undefined);
  assert.match(result.summary, /Successfully ran tests/);
  assert.equal((result.payload as { passed?: boolean })?.passed, true);
});

test('TestRunnerTool reports failure when injected runner throws', async () => {
  const tool = new TestRunnerTool(async () => {
    const err = Object.assign(new Error('npm failed'), {
      stdout: 'partial',
      stderr: 'err out',
    });
    throw err;
  });
  const result = await tool.execute({ target: 'backend' }, { actorRole: 'reviewer' });
  assert.equal(typeof result.error, 'string');
  assert.match(result.summary, /Tests failed/);
  assert.equal((result.payload as { passed?: boolean })?.passed, false);
});
