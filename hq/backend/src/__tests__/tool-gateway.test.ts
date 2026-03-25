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
  assert.equal(reviewerTools.some((tool) => tool.name === 'runtime_executor'), false);
  assert.equal(reviewerTools.some((tool) => tool.name === 'docs_search'), true);
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
    { task: 'Apply production migration' },
    { actorRole: 'backend-developer', taskId: 'task-1', executionId: 'execution-1' }
  );

  assert.equal(result.ok, false);
  assert.equal(result.log.status, 'blocked');
  assert.equal(result.log.riskLevel, 'high');
  assert.equal(savedLogs.length, 1);
});

test('tool gateway logs medium-risk tool execution when allowed', async () => {
  const savedLogs: ToolCallLog[] = [];
  const gateway = new ToolGateway({
    async saveToolCallLog(log: ToolCallLog) {
      savedLogs.push(log);
    },
  });

  const result = await gateway.executeTool(
    'test_runner',
    { target: 'backend' },
    { actorRole: 'backend-developer', taskId: 'task-1', executionId: 'execution-1' }
  );

  assert.equal(result.ok, true);
  assert.equal(result.log.status, 'completed');
  assert.equal(result.log.riskLevel, 'medium');
  assert.match(result.output?.summary ?? '', /(Ran bounded test target|Mock test execution successful)/);
  assert.equal(savedLogs.length, 1);
});
