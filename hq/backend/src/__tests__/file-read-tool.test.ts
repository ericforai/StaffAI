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
    const result = await tool.run({ path: 'temp-test-file.txt' });
    assert.equal(result.summary.toLowerCase().includes('read'), true);
    assert.equal((result.payload as { content?: string })?.content, 'hello from test');
  } finally {
    await fs.unlink(testFilePath);
  }
});

test('FileReadTool throws for missing file', async () => {
  const tool = new FileReadTool();
  await assert.rejects(() => tool.run({ path: 'non-existent-file.txt' }), /ENOENT/);
});
