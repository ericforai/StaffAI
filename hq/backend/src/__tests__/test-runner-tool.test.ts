import test from 'node:test';
import assert from 'node:assert/strict';
import { TestRunnerTool } from '../tools/test-runner-tool';

test('TestRunnerTool reports mock success when AGENCY_UNDER_NODE_TEST is set', async () => {
  const prev = process.env.AGENCY_UNDER_NODE_TEST;
  process.env.AGENCY_UNDER_NODE_TEST = '1';
  try {
    const tool = new TestRunnerTool();
    const result = await tool.run({ target: 'backend' });
    assert.equal(result.summary.toLowerCase().includes('mock'), true);
    assert.equal((result.payload as { passed?: boolean })?.passed, true);
  } finally {
    if (prev === undefined) {
      delete process.env.AGENCY_UNDER_NODE_TEST;
    } else {
      process.env.AGENCY_UNDER_NODE_TEST = prev;
    }
  }
});
