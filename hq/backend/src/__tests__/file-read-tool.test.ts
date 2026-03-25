import test from 'node:test';
import assert from 'node:assert/strict';
import { FileReadTool } from '../tools/file-read-tool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

test('FileReadTool correctly reads a file', async () => {
  const tool = new FileReadTool();
  const testFilePath = path.join(process.cwd(), 'temp-test-file.txt');
  await fs.writeFile(testFilePath, 'hello from test');

  try {
    const result = await tool.execute({ path: 'temp-test-file.txt' }, { actorRole: 'backend-developer' });
    assert.equal(result.summary.toLowerCase().includes('read file'), true);
    assert.equal(result.payload?.content, 'hello from test');
  } finally {
    await fs.unlink(testFilePath);
  }
});

test('FileReadTool returns error for missing file', async () => {
  const tool = new FileReadTool();
  const result = await tool.execute({ path: 'non-existent-file.txt' }, { actorRole: 'backend-developer' });
  assert.equal(result.error !== undefined, true);
  assert.match(result.error ?? '', /ENOENT/);
});

test('FileReadTool prevents reading outside workspace', async () => {
  const tool = new FileReadTool();
  const result = await tool.execute({ path: '../../../../etc/passwd' }, { actorRole: 'backend-developer' });
  assert.equal(result.error !== undefined, true);
  assert.match(result.error ?? '', /Access denied/);
});
