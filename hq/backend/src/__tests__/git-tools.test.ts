import test from 'node:test';
import assert from 'node:assert/strict';
import { GitReadTool, GitDiffTool } from '../tools/git-tools';

test('GitReadTool returns current branch or status', async () => {
  const tool = new GitReadTool();
  const result = await tool.run({ command: 'branch' });
  assert.equal(!result.error, true); // summary might vary, but shouldn't be an error if git is init
  assert.match(result.summary, /Git branch/i);
});

test('GitDiffTool returns diff', async () => {
  const tool = new GitDiffTool();
  const result = await tool.run({});
  assert.equal(!result.error, true);
  assert.match(result.summary, /Git diff/i);
});
