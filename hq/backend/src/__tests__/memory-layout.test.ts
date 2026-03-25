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

test('inferDocumentType correctly identifies PROJECT documents', () => {
  assert.equal(inferDocumentType('context/project.md'), 'PROJECT');
  assert.equal(inferType('context/some-file.md'), 'PROJECT');
  assert.equal(inferDocumentType('context/subdir/file.md'), 'PROJECT');
});

test('inferDocumentType correctly identifies TASK documents', () => {
  assert.equal(inferDocumentType('tasks/task-123.md'), 'TASK');
  assert.equal(inferDocumentType('tasks/subtask/abc.md'), 'TASK');
  assert.equal(inferDocumentType('subdir/tasks/file.md'), 'TASK');
});

test('inferDocumentType correctly identifies DECISION documents', () => {
  assert.equal(inferDocumentType('decisions/arch-001.md'), 'DECISION');
  assert.equal(inferDocumentType('decisions/database/2024-03-25.md'), 'DECISION');
  assert.equal(inferDocumentType('subdir/decisions/file.md'), 'DECISION');
});

test('inferDocumentType correctly identifies KNOWLEDGE documents', () => {
  assert.equal(inferDocumentType('knowledge/api-endpoints.md'), 'KNOWLEDGE');
  assert.equal(inferDocumentType('knowledge/auth/oauth.md'), 'KNOWLEDGE');
  assert.equal(inferDocumentType('subdir/knowledge/file.md'), 'KNOWLEDGE');
});

test('inferDocumentType correctly identifies AGENT documents', () => {
  assert.equal(inferDocumentType('agents/seo-specialist.md'), 'AGENT');
  assert.equal(inferDocumentType('agents/frontend-dev/preferences.md'), 'AGENT');
  assert.equal(inferDocumentType('subdir/agents/file.md'), 'AGENT');
});

test('inferDocumentType correctly identifies SHARED documents', () => {
  assert.equal(inferDocumentType('task-summaries/2024-03-25-task-1.md'), 'SHARED');
  assert.equal(inferDocumentType('task-summaries/completed/task-2.md'), 'SHARED');
  assert.equal(inferDocumentType('subdir/task-summaries/file.md'), 'SHARED');
});

test('inferDocumentType returns null for unknown paths', () => {
  assert.equal(inferDocumentType('unknown/file.md'), null);
  assert.equal(inferDocumentType('random/path/doc.md'), null);
  assert.equal(inferDocumentType(''), null);
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

// Helper function for type inference tests
function inferType(path: string): MemoryDocumentType | null {
  return inferDocumentType(path);
}
