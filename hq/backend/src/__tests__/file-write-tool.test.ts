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
    const result = await tool.run({ path: testFilePath, content: 'written from test' });
    assert.equal(result.summary.toLowerCase().includes('wrote'), true);
    const content = await fs.readFile(fullPath, 'utf8');
    assert.equal(content, 'written from test');
  } finally {
    if (await fs.stat(fullPath).catch(() => null)) {
      await fs.unlink(fullPath);
    }
  }
});
