import test from 'node:test';
import assert from 'node:assert/strict';
import { GitReadTool, GitDiffTool } from '../tools/git-tools';

test('GitReadTool returns current branch or status', async () => {
  const tool = new GitReadTool();
  const result = await tool.execute({ command: 'branch' }, { actorRole: 'backend-developer' });
  assert.equal(!result.error, true); // summary might vary, but shouldn't be an error if git is init
  assert.match(result.summary, /Git branch/);
});

test('GitDiffTool returns diff', async () => {
  const tool = new GitDiffTool();
  const result = await tool.execute({}, { actorRole: 'backend-developer' });
  assert.equal(!result.error, true);
  assert.match(result.summary, /Git diff/);
});
