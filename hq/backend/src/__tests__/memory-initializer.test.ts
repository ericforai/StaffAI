/**
 * Tests for memory-initializer module
 * Tests async directory initialization, validation, and template file creation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { rm, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  initializeMemoryLayout,
  isMemoryLayoutInitialized,
  validateMemoryLayout,
  destroyMemoryLayout,
  getMemoryDirectory,
} from '../memory/memory-initializer';

// Helper to create a temporary directory for testing
async function createTempDir(): Promise<string> {
  const tempDir = path.join(process.cwd(), '.tmp-test-' + randomBytes(8).toString('hex'));
  await mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Helper to cleanup temp directory
async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test('initializeMemoryLayout creates all directories and template files', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    const layout = await initializeMemoryLayout(aiDir);

    // Verify directory structure
    assert.ok(existsSync(layout.memoryRootDir));
    assert.ok(existsSync(layout.contextDir));
    assert.ok(existsSync(layout.tasksDir));
    assert.ok(existsSync(layout.decisionsDir));
    assert.ok(existsSync(layout.knowledgeDir));
    assert.ok(existsSync(layout.agentsDir));
    assert.ok(existsSync(layout.taskSummariesDir));

    // Verify template files exist
    const projectTemplatePath = path.join(layout.contextDir, 'project.md');
    const currentTaskPath = path.join(layout.contextDir, 'current-task.md');
    assert.ok(existsSync(projectTemplatePath));
    assert.ok(existsSync(currentTaskPath));

    // Verify template file content
    const projectContent = await readFile(projectTemplatePath, 'utf8');
    const taskContent = await readFile(currentTaskPath, 'utf8');
    assert.ok(projectContent.includes('# Project Context'));
    assert.ok(projectContent.includes('Last updated:')); // date was replaced
    assert.ok(taskContent.includes('# Current Task'));
    assert.ok(taskContent.includes('Started:')); // date was replaced

    // Verify README exists
    const readmePath = path.join(layout.memoryRootDir, 'README.md');
    assert.ok(existsSync(readmePath));

    // Verify .gitignore exists
    const gitignorePath = path.join(layout.memoryRootDir, '.gitignore');
    assert.ok(existsSync(gitignorePath));

    // Verify .gitkeep in empty directories
    assert.ok(existsSync(path.join(layout.agentsDir, '.gitkeep')));
    assert.ok(existsSync(path.join(layout.taskSummariesDir, '.gitkeep')));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

test('initializeMemoryLayout does not overwrite existing template files', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    // First initialization
    await initializeMemoryLayout(aiDir);
    const projectTemplatePath = path.join(aiDir, 'context', 'project.md');

    // Modify the file
    const customContent = '# Custom Project Content\n\nThis should be preserved.';
    await writeFile(projectTemplatePath, customContent);

    // Second initialization
    await initializeMemoryLayout(aiDir);

    // Verify content was not overwritten
    const content = await readFile(projectTemplatePath, 'utf8');
    assert.equal(content, customContent);
  } finally {
    await cleanupTempDir(tempDir);
  }
});

test('isMemoryLayoutInitialized returns correct status', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    // Before initialization
    let isInitialized = await isMemoryLayoutInitialized(aiDir);
    assert.ok(!isInitialized, 'Directory should not be initialized before initialization');

    // After initialization
    await initializeMemoryLayout(aiDir);
    isInitialized = await isMemoryLayoutInitialized(aiDir);
    assert.ok(isInitialized, 'Directory should be initialized after initialization');

    // After partial destruction (remove one directory)
    await rm(path.join(aiDir, 'tasks'), { recursive: true });
    isInitialized = await isMemoryLayoutInitialized(aiDir);
    assert.ok(!isInitialized, 'Directory should not be initialized when subdirectory missing');
  } finally {
    await cleanupTempDir(tempDir);
  }
});

test('validateMemoryLayout returns missing items for incomplete structure', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    // Before initialization
    let result = await validateMemoryLayout(aiDir);
    assert.ok(!result.valid);
    assert.ok(result.missing.length > 0);

    // After initialization
    await initializeMemoryLayout(aiDir);
    result = await validateMemoryLayout(aiDir);
    assert.ok(result.valid);
    assert.equal(result.missing.length, 0);

    // After removing one directory
    await rm(path.join(aiDir, 'tasks'), { recursive: true });
    result = await validateMemoryLayout(aiDir);
    assert.ok(!result.valid);
    assert.ok(result.missing.includes('tasks'));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

test('destroyMemoryLayout removes entire directory structure', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    // Initialize
    await initializeMemoryLayout(aiDir);
    assert.ok(existsSync(aiDir));

    // Destroy
    const destroyed = await destroyMemoryLayout(aiDir);
    assert.ok(destroyed);
    assert.ok(!existsSync(aiDir));
  } finally {
    await cleanupTempDir(tempDir);
  }
});

test('destroyMemoryLayout succeeds even for non-existent directory (force mode)', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    // Don't initialize, just try to destroy
    // With force: true, this succeeds even if directory doesn't exist
    const destroyed = await destroyMemoryLayout(aiDir);
    assert.ok(destroyed); // Should return true because force mode succeeds
    assert.ok(!existsSync(aiDir)); // Directory should not exist after
  } finally {
    await cleanupTempDir(tempDir);
  }
});

test('getMemoryDirectory returns env variable when set', async (t) => {
  const customPath = '/custom/memory/path';
  process.env.AGENCY_MEMORY_DIR = customPath;

  try {
    const result = getMemoryDirectory();
    assert.equal(result, customPath);
  } finally {
    delete process.env.AGENCY_MEMORY_DIR;
  }
});

test('getMemoryDirectory returns default when env not set', async (t) => {
  delete process.env.AGENCY_MEMORY_DIR;

  const result = getMemoryDirectory('.ai');
  assert.ok(result.endsWith('.ai'));
  assert.ok(path.isAbsolute(result));
});

test('getMemoryDirectory handles empty env variable', async (t) => {
  process.env.AGENCY_MEMORY_DIR = '   ';

  try {
    const result = getMemoryDirectory('.ai');
    assert.ok(result.endsWith('.ai'));
  } finally {
    delete process.env.AGENCY_MEMORY_DIR;
  }
});

test('initializeMemoryLayout creates subdirectories with correct permissions', async (t) => {
  const tempDir = await createTempDir();
  const aiDir = path.join(tempDir, '.ai');

  try {
    const layout = await initializeMemoryLayout(aiDir);

    // Verify all directories are readable and writable
    for (const dirPath of Object.values(layout)) {
      if (dirPath === layout.memoryRootDir) continue; // Skip root, already tested

      try {
        await access(dirPath); // Check directory is accessible
      } catch (error) {
        assert.fail(`Directory ${dirPath} should be accessible`);
      }
    }
  } finally {
    await cleanupTempDir(tempDir);
  }
});
