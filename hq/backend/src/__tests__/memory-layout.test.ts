/**
 * Tests for memory-layout module
 * Tests directory structure creation, document type inference, and template formatting
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryLayout,
  inferDocumentType,
  formatTemplate,
  isValidDocumentType,
  getSubdirectoryForType,
  MEMORY_DOCUMENT_TYPES,
  MEMORY_FILE_NAMES,
  MEMORY_SUBDIRS,
  type MemoryDirectoryLayout,
  type MemoryDocumentType,
} from '../memory/memory-layout';

test('createMemoryLayout returns valid directory structure', () => {
  const root = '/test/path/.ai';
  const layout = createMemoryLayout(root);

  assert.equal(layout.memoryRootDir, root);
  assert.equal(layout.contextDir, '/test/path/.ai/context');
  assert.equal(layout.tasksDir, '/test/path/.ai/tasks');
  assert.equal(layout.decisionsDir, '/test/path/.ai/decisions');
  assert.equal(layout.knowledgeDir, '/test/path/.ai/knowledge');
  assert.equal(layout.agentsDir, '/test/path/.ai/agents');
  assert.equal(layout.taskSummariesDir, '/test/path/.ai/task-summaries');
});

test('createMemoryLayout uses path.join for cross-platform compatibility', () => {
  const root = '/test/path/.ai';
  const layout = createMemoryLayout(root);

  // Verify all paths start with the root
  const values: string[] = Object.values(layout);
  for (const value of values) {
    assert.ok(value.startsWith(root));
  }
});

function assertDocumentType(paths: string[], expected: MemoryDocumentType | null): void {
  for (const filePath of paths) {
    assert.equal(inferDocumentType(filePath), expected);
  }
}

test('inferDocumentType correctly identifies PROJECT documents', () => {
  assertDocumentType(
    ['context/project.md', 'context/some-file.md', 'context/subdir/file.md'],
    'PROJECT'
  );
});

test('inferDocumentType correctly identifies TASK documents', () => {
  assertDocumentType(
    ['tasks/task-123.md', 'tasks/subtask/abc.md', 'subdir/tasks/file.md'],
    'TASK'
  );
});

test('inferDocumentType correctly identifies DECISION documents', () => {
  assertDocumentType(
    ['decisions/arch-001.md', 'decisions/database/2024-03-25.md', 'subdir/decisions/file.md'],
    'DECISION'
  );
});

test('inferDocumentType correctly identifies KNOWLEDGE documents', () => {
  assertDocumentType(
    ['knowledge/api-endpoints.md', 'knowledge/auth/oauth.md', 'subdir/knowledge/file.md'],
    'KNOWLEDGE'
  );
});

test('inferDocumentType correctly identifies AGENT documents', () => {
  assertDocumentType(
    ['agents/seo-specialist.md', 'agents/frontend-dev/preferences.md', 'subdir/agents/file.md'],
    'AGENT'
  );
});

test('inferDocumentType correctly identifies SHARED documents', () => {
  assertDocumentType(
    ['task-summaries/2024-03-25-task-1.md', 'task-summaries/completed/task-2.md', 'subdir/task-summaries/file.md'],
    'SHARED'
  );
});

test('inferDocumentType returns null for unknown paths', () => {
  assertDocumentType(['unknown/file.md', 'random/path/doc.md', ''], null);
});

test('inferDocumentType handles Windows paths', () => {
  assert.equal(inferDocumentType('tasks\\task-123.md'), 'TASK');
  assert.equal(inferDocumentType('decisions\\arch.md'), 'DECISION');
});

test('inferDocumentType handles mixed case paths', () => {
  assert.equal(inferDocumentType('Tasks/Task-123.md'), 'TASK');
  assert.equal(inferDocumentType('DECISIONS/ARCH.md'), 'DECISION');
  assert.equal(inferDocumentType('Knowledge/API.md'), 'KNOWLEDGE');
});

test('formatTemplate replaces {{date}} placeholder', () => {
  const template = 'Created on {{date}}';
  const result = formatTemplate(template, new Date('2026-03-25'));
  assert.ok(result.includes('2026-03-25'));
  assert.ok(!result.includes('{{date}}'));
});

test('formatTemplate replaces {{year}}, {{month}}, {{day}} placeholders', () => {
  const template = '{{year}}-{{month}}-{{day}}';
  const result = formatTemplate(template, new Date('2026-03-25'));
  assert.equal(result, '2026-03-25');
});

test('formatTemplate uses current date by default', () => {
  const template = '{{date}}';
  const result = formatTemplate(template);
  // Match ISO date format: YYYY-MM-DD
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result));
});

test('formatTemplate handles multiple placeholders', () => {
  const template = 'Date: {{date}}, Year: {{year}}';
  const result = formatTemplate(template, new Date('2026-03-25'));
  assert.ok(result.includes('2026-03-25'));
  assert.ok(result.includes('2026'));
});

test('formatTemplate leaves unknown placeholders untouched', () => {
  const template = 'Unknown: {{unknown}}, Date: {{date}}';
  const result = formatTemplate(template, new Date('2026-03-25'));
  assert.ok(result.includes('{{unknown}}'));
  assert.ok(!result.includes('{{date}}'));
});

test('isValidDocumentType validates document types', () => {
  assert.ok(isValidDocumentType('PROJECT'));
  assert.ok(isValidDocumentType('TASK'));
  assert.ok(isValidDocumentType('DECISION'));
  assert.ok(isValidDocumentType('KNOWLEDGE'));
  assert.ok(isValidDocumentType('AGENT'));
  assert.ok(isValidDocumentType('SHARED'));
  assert.ok(!isValidDocumentType('INVALID'));
  assert.ok(!isValidDocumentType(''));
  assert.ok(!isValidDocumentType('project')); // case-sensitive
});

test('getSubdirectoryForType returns correct subdirectory', () => {
  assert.equal(getSubdirectoryForType('PROJECT'), 'context');
  assert.equal(getSubdirectoryForType('TASK'), 'tasks');
  assert.equal(getSubdirectoryForType('DECISION'), 'decisions');
  assert.equal(getSubdirectoryForType('KNOWLEDGE'), 'knowledge');
  assert.equal(getSubdirectoryForType('AGENT'), 'agents');
  assert.equal(getSubdirectoryForType('SHARED'), 'task-summaries');
});

test('MEMORY_DOCUMENT_TYPES contains all expected types', () => {
  const expected = ['PROJECT', 'TASK', 'DECISION', 'KNOWLEDGE', 'AGENT', 'SHARED'];
  assert.deepEqual(Array.from(MEMORY_DOCUMENT_TYPES), expected);
});

test('MEMORY_SUBDIRS contains all expected subdirectories', () => {
  const expected = [
    'context',
    'tasks',
    'decisions',
    'knowledge',
    'knowledge/successes',
    'knowledge/failures',
    'agents',
    'task-summaries',
  ];
  assert.deepEqual(Array.from(MEMORY_SUBDIRS), expected);
});

test('MEMORY_FILE_NAMES contains expected file names', () => {
  assert.equal(MEMORY_FILE_NAMES.PROJECT_CONTEXT, 'project.md');
  assert.equal(MEMORY_FILE_NAMES.CURRENT_TASK, 'current-task.md');
});
