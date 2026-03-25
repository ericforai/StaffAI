import test from 'node:test';
import assert from 'node:assert/strict';
import type { ToolCallLog } from '../shared/task-types';
import { ToolGateway } from '../tools/tool-gateway';

test('tool gateway filters visible tools by role', () => {
  const savedLogs: ToolCallLog[] = [];
  const gateway = new ToolGateway({
    async saveToolCallLog(log: ToolCallLog) {
      savedLogs.push(log);
    },
  });

  const reviewerTools = gateway.listTools('reviewer');
  // file_write is NOT for reviewer
  assert.equal(reviewerTools.some((tool) => tool.name === 'file_write'), false);
  // file_read IS for reviewer
  assert.equal(reviewerTools.some((tool) => tool.name === 'file_read'), true);
  assert.equal(savedLogs.length, 0);
});

test('tool gateway blocks high-risk tools without approval', async () => {
  const savedLogs: ToolCallLog[] = [];
  const gateway = new ToolGateway({
    async saveToolCallLog(log: ToolCallLog) {
      savedLogs.push(log);
    },
  });

  const result = await gateway.executeTool(
    'runtime_executor',
    { task: 'do something risky' },
    { actorRole: 'backend-developer', taskId: 'task-1', executionId: 'execution-1' }
  );

  assert.equal(result.ok, false);
  assert.equal(result.log.status, 'blocked');
  assert.equal(result.log.riskLevel, 'high');
  assert.equal(savedLogs.length, 1);
});

test('tool gateway executes low-risk tool when allowed', async () => {
  const savedLogs: ToolCallLog[] = [];
  const gateway = new ToolGateway({
    async saveToolCallLog(log: ToolCallLog) {
      savedLogs.push(log);
    },
  });

  const result = await gateway.executeTool(
    'file_read',
    { path: 'package.json' },
    { actorRole: 'backend-developer', taskId: 'task-1', executionId: 'execution-1' }
  );

  if (!result.ok) {
    console.error('Tool execution failed:', result.error);
  }
  assert.equal(result.ok, true);
  assert.equal(result.log.status, 'completed');
  assert.equal(result.log.riskLevel, 'low');
  assert.match(result.output?.summary ?? '', /read/i);
  assert.equal(savedLogs.length, 1);
});
