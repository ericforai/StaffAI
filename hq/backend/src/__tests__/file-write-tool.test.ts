import test from 'node:test';
import assert from 'node:assert/strict';
import { FileWriteTool } from '../tools/file-write-tool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

test('FileWriteTool correctly writes a file', async () => {
  const tool = new FileWriteTool();
  const testFilePath = 'temp-write-test.txt';
  const fullPath = path.join(process.cwd(), testFilePath);

  try {
    const result = await tool.execute({ path: testFilePath, content: 'written from test' }, { actorRole: 'backend-developer', approvalGranted: true });
    assert.equal(result.summary.includes('Successfully wrote'), true);
    const content = await fs.readFile(fullPath, 'utf8');
    assert.equal(content, 'written from test');
  } finally {
    if (await fs.stat(fullPath).catch(() => null)) {
      await fs.unlink(fullPath);
    }
  }
});

test('FileWriteTool blocks without approval', async () => {
  const tool = new FileWriteTool();
  const result = await tool.execute({ path: 'blocked.txt', content: 'should not write' }, { actorRole: 'backend-developer', approvalGranted: false });
  assert.equal(result.error !== undefined, true);
  assert.match(result.error ?? '', /requires explicit approval/);
});

test('FileWriteTool prevents writing outside workspace', async () => {
  const tool = new FileWriteTool();
  const result = await tool.execute({ path: '../../outside.txt', content: 'poison' }, { actorRole: 'backend-developer', approvalGranted: true });
  assert.equal(result.error !== undefined, true);
  assert.match(result.error ?? '', /Access denied/);
});
