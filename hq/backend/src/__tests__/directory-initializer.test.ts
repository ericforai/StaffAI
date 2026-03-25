import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initializeAiDirectory,
  createDirectoryStructure,
  generateTemplateFiles,
  verifyDirectoryStructure,
  type DirectoryInitOptions,
  type DirectoryStructure,
} from '../memory/directory-initializer';

test('initializeAiDirectory creates .ai directory with full structure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-init-'));
  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: true,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);
  assert.ok(result.aiDir);
  assert.ok(fs.existsSync(result.aiDir));
  assert.equal(result.created.length, 7);

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory does not overwrite existing directories without force', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-existing-'));
  const aiDir = path.join(root, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  const testFile = path.join(aiDir, 'existing.txt');
  fs.writeFileSync(testFile, 'existing content', 'utf8');

  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: true,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);
  assert.ok(fs.existsSync(testFile));
  assert.equal(result.created.length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory overwrites when force is true', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-force-'));
  const aiDir = path.join(root, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  const testFile = path.join(aiDir, 'existing.txt');
  fs.writeFileSync(testFile, 'existing content', 'utf8');

  const options: DirectoryInitOptions = {
    rootDir: root,
    force: true,
    templates: true,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);
  assert.ok(!fs.existsSync(testFile));

  fs.rmSync(root, { recursive: true, force: true });
});

test('createDirectoryStructure creates all required subdirectories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-dirs-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);

  const expectedDirs = [
    'notes',
    'decisions',
    'playbooks',
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  for (const dir of expectedDirs) {
    const dirPath = path.join(aiDir, dir);
    assert.ok(fs.existsSync(dirPath), `Directory ${dir} should exist`);
    assert.ok(fs.statSync(dirPath).isDirectory(), `${dir} should be a directory`);
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('createDirectoryStructure handles partial existing directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-partial-'));
  const aiDir = path.join(root, '.ai');

  fs.mkdirSync(path.join(aiDir, 'notes'), { recursive: true });

  createDirectoryStructure(aiDir);

  const expectedDirs = [
    'notes',
    'decisions',
    'playbooks',
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  for (const dir of expectedDirs) {
    assert.ok(fs.existsSync(path.join(aiDir, dir)));
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('createDirectoryStructure is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-idempotent-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);
  createDirectoryStructure(aiDir);

  const expectedDirs = [
    'notes',
    'decisions',
    'playbooks',
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  for (const dir of expectedDirs) {
    assert.ok(fs.existsSync(path.join(aiDir, dir)));
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('generateTemplateFiles creates template files in directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-templates-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);
  generateTemplateFiles(aiDir);

  const templateFiles = [
    { path: path.join(aiDir, 'notes', '_template.md'), content: '# Note Template' },
    { path: path.join(aiDir, 'decisions', '_template.md'), content: '# Decision Record' },
    { path: path.join(aiDir, 'playbooks', '_template.md'), content: '# Playbook' },
    { path: path.join(aiDir, 'meetings', '_template.md'), content: '# Meeting Notes' },
  ];

  for (const { path: filePath, content } of templateFiles) {
    assert.ok(fs.existsSync(filePath), `Template ${filePath} should exist`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    assert.ok(fileContent.includes(content), `Template should include ${content}`);
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('generateTemplateFiles does not overwrite existing templates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-no-overwrite-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);

  const templatePath = path.join(aiDir, 'notes', '_template.md');
  fs.writeFileSync(templatePath, 'Custom template content', 'utf8');

  generateTemplateFiles(aiDir);

  const content = fs.readFileSync(templatePath, 'utf8');
  assert.equal(content, 'Custom template content');

  fs.rmSync(root, { recursive: true, force: true });
});

test('generateTemplateFiles creates README in .ai root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-readme-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);
  generateTemplateFiles(aiDir);

  const readmePath = path.join(aiDir, 'README.md');
  assert.ok(fs.existsSync(readmePath));

  const content = fs.readFileSync(readmePath, 'utf8');
  assert.ok(content.includes('Memory'));
  assert.ok(content.includes('Knowledge'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyDirectoryStructure returns true for valid structure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-verify-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);

  const result = verifyDirectoryStructure(aiDir);

  assert.equal(result.valid, true);
  assert.equal(result.missing.length, 0);

  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyDirectoryStructure detects missing directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-missing-'));
  const aiDir = path.join(root, '.ai');

  fs.mkdirSync(path.join(aiDir, 'notes'), { recursive: true });

  const result = verifyDirectoryStructure(aiDir);

  assert.equal(result.valid, false);
  assert.ok(result.missing.length > 0);
  assert.ok(result.missing.includes('decisions'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyDirectoryStructure handles non-existent .ai directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-nonexist-'));
  const aiDir = path.join(root, '.ai');

  const result = verifyDirectoryStructure(aiDir);

  assert.equal(result.valid, false);
  assert.equal(result.missing.length, 7);
});

test('initializeAiDirectory creates custom directory structure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-custom-'));
  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: true,
    customDirs: ['custom1', 'custom2'],
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);
  assert.ok(fs.existsSync(path.join(result.aiDir!, 'custom1')));
  assert.ok(fs.existsSync(path.join(result.aiDir!, 'custom2')));

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory skips templates when templates is false', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-no-templates-'));
  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: false,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);
  assert.ok(!fs.existsSync(path.join(result.aiDir!, 'notes', '_template.md')));

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory returns created directories list', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-list-'));
  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: true,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.created));
  assert.ok(result.created.length >= 7);

  const expectedDirs = [
    'notes',
    'decisions',
    'playbooks',
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  for (const dir of expectedDirs) {
    assert.ok(result.created.includes(dir));
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory handles permission errors gracefully', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-perm-'));
  const aiDir = path.join(root, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  const options: DirectoryInitOptions = {
    rootDir: root,
    force: true,
    templates: true,
  };

  const originalRmSync = fs.rmSync;
  fs.rmSync = ((targetPath: fs.PathLike, rmOptions?: fs.RmOptions) => {
    if (targetPath === aiDir) {
      const error = new Error('EACCES: permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      throw error;
    }
    return originalRmSync(targetPath, rmOptions);
  }) as typeof fs.rmSync;

  try {
    const result = initializeAiDirectory(options);

    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.match(result.error, /EACCES|permission denied/i);
  } finally {
    fs.rmSync = originalRmSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('generateTemplateFiles creates .gitkeep in empty directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-gitkeep-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);
  generateTemplateFiles(aiDir);

  const dirs = [
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  for (const dir of dirs) {
    const gitkeepPath = path.join(aiDir, dir, '.gitkeep');
    assert.ok(fs.existsSync(gitkeepPath), `${dir}/.gitkeep should exist`);
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyDirectoryStructure checks template files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-verify-templates-'));
  const aiDir = path.join(root, '.ai');

  createDirectoryStructure(aiDir);

  const resultWithoutTemplates = verifyDirectoryStructure(aiDir, { checkTemplates: false });
  assert.equal(resultWithoutTemplates.valid, true);

  generateTemplateFiles(aiDir);

  const resultWithTemplates = verifyDirectoryStructure(aiDir, { checkTemplates: true });
  assert.equal(resultWithTemplates.valid, true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory supports custom templates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-custom-templates-'));
  const customTemplates = {
    'notes': '# Custom Note Template\nCustom fields here.\n',
    'decisions': '# Custom Decision Template\nCustom decision format.\n',
  };

  const options: DirectoryInitOptions = {
    rootDir: root,
    force: true,
    templates: true,
    customTemplates,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);

  const noteTemplate = fs.readFileSync(
    path.join(result.aiDir!, 'notes', '_template.md'),
    'utf8'
  );
  assert.ok(noteTemplate.includes('Custom Note Template'));

  const decisionTemplate = fs.readFileSync(
    path.join(result.aiDir!, 'decisions', '_template.md'),
    'utf8'
  );
  assert.ok(decisionTemplate.includes('Custom Decision Template'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory creates user.json template', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-user-'));
  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: true,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);

  const userJsonPath = path.join(result.aiDir!, 'user.json.example');
  assert.ok(fs.existsSync(userJsonPath));

  const content = fs.readFileSync(userJsonPath, 'utf8');
  const userConfig = JSON.parse(content);
  assert.ok(userConfig.id);
  assert.ok(userConfig.name);
  assert.ok(userConfig.accessLevel);

  fs.rmSync(root, { recursive: true, force: true });
});

test('initializeAiDirectory creates .gitignore in .ai directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-gitignore-'));
  const options: DirectoryInitOptions = {
    rootDir: root,
    force: false,
    templates: true,
  };

  const result = initializeAiDirectory(options);

  assert.equal(result.success, true);

  const gitignorePath = path.join(result.aiDir!, '.gitignore');
  assert.ok(fs.existsSync(gitignorePath));

  const content = fs.readFileSync(gitignorePath, 'utf8');
  assert.ok(content.includes('user.json'));
  assert.ok(content.includes('*.log'));

  fs.rmSync(root, { recursive: true, force: true });
});
