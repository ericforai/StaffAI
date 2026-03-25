/**
 * Memory Initializer
 *
 * Asynchronous initializer for the .ai/ memory directory structure.
 * Ensures all required directories and template files exist on startup.
 *
 * @module memory/memory-initializer
 */

import { promises as fs } from 'fs';
import path from 'node:path';
import type { MemoryDirectoryLayout } from './memory-layout';
import {
  createMemoryLayout,
  formatTemplate,
  PROJECT_TEMPLATE,
  CURRENT_TASK_TEMPLATE,
  MEMORY_FILE_NAMES,
  MEMORY_SUBDIRS,
} from './memory-layout';

/**
 * Initializes the .ai/ directory structure with all required subdirectories
 * and template files.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns The directory layout object with all paths
 * @throws Error if directory creation fails
 *
 * @example
 * ```ts
 * const layout = await initializeMemoryLayout('/path/to/.ai');
 * console.log('Memory initialized at', layout.memoryRootDir);
 * ```
 */
export async function initializeMemoryLayout(memoryRootDir: string): Promise<MemoryDirectoryLayout> {
  const layout = createMemoryLayout(memoryRootDir);

  // Create the root directory
  await fs.mkdir(memoryRootDir, { recursive: true });

  // Create all subdirectories
  for (const subdir of MEMORY_SUBDIRS) {
    const dirPath = path.join(memoryRootDir, subdir);
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Create template files in context directory
  const projectContextPath = path.join(layout.contextDir, MEMORY_FILE_NAMES.PROJECT_CONTEXT);
  await ensureTemplateFile(projectContextPath, formatTemplate(PROJECT_TEMPLATE));

  const currentTaskPath = path.join(layout.contextDir, MEMORY_FILE_NAMES.CURRENT_TASK);
  await ensureTemplateFile(currentTaskPath, formatTemplate(CURRENT_TASK_TEMPLATE));

  // Create .gitkeep in empty directories to ensure they're tracked by git
  const emptyDirs = [layout.agentsDir, layout.taskSummariesDir];
  for (const dir of emptyDirs) {
    const gitkeepPath = path.join(dir, '.gitkeep');
    try {
      await fs.access(gitkeepPath);
    } catch {
      await fs.writeFile(gitkeepPath, '', 'utf8');
    }
  }

  // Create README.md if it doesn't exist
  const readmePath = path.join(memoryRootDir, 'README.md');
  try {
    await fs.access(readmePath);
  } catch {
    await fs.writeFile(
      readmePath,
      `# AI Memory & Knowledge

This directory stores persistent memory and knowledge for the AI system.

## Directory Structure

- \`context/\` - Project context and current task tracking
- \`tasks/\` - Task-specific documentation and notes
- \`decisions/\` - Architectural and technical decision records
- \`knowledge/\` - General knowledge base articles
- \`agents/\` - Agent-specific memory and preferences
- \`task-summaries/\` - Execution summaries and outcomes

## Usage

This directory is automatically indexed and searchable by the memory retrieval system.
Documents are organized by type for efficient retrieval.

## Configuration

The memory directory location can be configured via the \`AGENCY_MEMORY_DIR\` environment variable.
`,
      'utf8'
    );
  }

  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(memoryRootDir, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(
      gitignorePath,
      `# User-specific configuration
user.json

# Log files
*.log

# Temporary files
*.tmp
*.temp

# OS files
.DS_Store
Thumbs.db
`,
      'utf8'
    );
  }

  return layout;
}

/**
 * Ensures a template file exists, creating it if missing.
 * Does not overwrite existing files.
 *
 * @param filePath - Absolute path to the template file
 * @param content - Template content to write if file doesn't exist
 */
async function ensureTemplateFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath);
    // File exists, don't overwrite
  } catch {
    // File doesn't exist, create it
    await fs.writeFile(filePath, content, 'utf8');
  }
}

/**
 * Checks if the .ai/ directory structure has been initialized.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns true if the directory structure exists and is complete
 *
 * @example
 * ```ts
 * if (!await isMemoryLayoutInitialized('/path/to/.ai')) {
 *   await initializeMemoryLayout('/path/to/.ai');
 * }
 * ```
 */
export async function isMemoryLayoutInitialized(memoryRootDir: string): Promise<boolean> {
  try {
    // Check if root directory exists
    await fs.access(memoryRootDir);

    // Check if all subdirectories exist
    const layout = createMemoryLayout(memoryRootDir);
    const requiredDirs = [
      layout.contextDir,
      layout.tasksDir,
      layout.decisionsDir,
      layout.knowledgeDir,
      layout.agentsDir,
      layout.taskSummariesDir,
    ];

    for (const dir of requiredDirs) {
      await fs.access(dir);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current memory directory from environment or default.
 *
 * @param fallbackDir - Fallback directory if AGENCY_MEMORY_DIR is not set
 * @returns The memory directory path
 */
export function getMemoryDirectory(fallbackDir: string = '.ai'): string {
  const envDir = process.env.AGENCY_MEMORY_DIR;
  if (envDir && envDir.trim().length > 0) {
    return path.resolve(envDir);
  }
  return path.resolve(process.cwd(), fallbackDir);
}

/**
 * Validates that the memory directory structure is complete.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns Object with validation result and any missing items
 */
export async function validateMemoryLayout(
  memoryRootDir: string
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];
  const layout = createMemoryLayout(memoryRootDir);

  // Check root directory
  try {
    await fs.access(layout.memoryRootDir);
  } catch {
    missing.push('<root>');
  }

  // Check subdirectories
  const dirsToCheck: Array<{ name: string; dirPath: string }> = [
    { name: 'context', dirPath: layout.contextDir },
    { name: 'tasks', dirPath: layout.tasksDir },
    { name: 'decisions', dirPath: layout.decisionsDir },
    { name: 'knowledge', dirPath: layout.knowledgeDir },
    { name: 'agents', dirPath: layout.agentsDir },
    { name: 'task-summaries', dirPath: layout.taskSummariesDir },
  ];

  for (const { name, dirPath } of dirsToCheck) {
    try {
      await fs.access(dirPath);
    } catch {
      missing.push(name);
    }
  }

  // Check template files
  const templateFiles: Array<{ name: string; filePath: string }> = [
    { name: 'context/project.md', filePath: path.join(layout.contextDir, MEMORY_FILE_NAMES.PROJECT_CONTEXT) },
    { name: 'context/current-task.md', filePath: path.join(layout.contextDir, MEMORY_FILE_NAMES.CURRENT_TASK) },
  ];

  for (const { name, filePath } of templateFiles) {
    try {
      await fs.access(filePath);
    } catch {
      missing.push(name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Removes the .ai/ directory structure entirely.
 * Use with caution - this deletes all memory data.
 *
 * @param memoryRootDir - Absolute path to the .ai/ directory
 * @returns true if successfully removed
 */
export async function destroyMemoryLayout(memoryRootDir: string): Promise<boolean> {
  try {
    await fs.rm(memoryRootDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
