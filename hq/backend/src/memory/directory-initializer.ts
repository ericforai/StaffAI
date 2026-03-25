import fs from 'node:fs';
import path from 'node:path';

export interface DirectoryInitOptions {
  rootDir: string;
  force?: boolean;
  templates?: boolean;
  customDirs?: string[];
  customTemplates?: Record<string, string>;
}

export interface DirectoryInitResult {
  success: boolean;
  aiDir?: string;
  created: string[];
  error?: string;
}

export interface DirectoryStructure {
  [key: string]: DirectoryStructure | null;
}

export function initializeAiDirectory(options: DirectoryInitOptions): DirectoryInitResult {
  const { rootDir, force = false, templates = true, customDirs = [], customTemplates = {} } = options;
  const aiDir = path.join(rootDir, '.ai');

  try {
    if (fs.existsSync(aiDir)) {
      if (!force) {
        return {
          success: true,
          aiDir,
          created: [],
        };
      }

      fs.rmSync(aiDir, { recursive: true, force: true });
    }

    fs.mkdirSync(aiDir, { recursive: true });

    const created = createDirectoryStructure(aiDir, customDirs);

    if (templates) {
      generateTemplateFiles(aiDir, customTemplates);
    }

    return {
      success: true,
      aiDir,
      created,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      created: [],
    };
  }
}

export function createDirectoryStructure(aiDir: string, customDirs: string[] = []): string[] {
  const standardDirs = [
    'notes',
    'decisions',
    'playbooks',
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  const allDirs = [...standardDirs, ...customDirs];
  const created: string[] = [];

  for (const dir of allDirs) {
    const dirPath = path.join(aiDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      created.push(dir);
    }
  }

  return created;
}

export function generateTemplateFiles(
  aiDir: string,
  customTemplates: Record<string, string> = {}
): void {
  const normalizedCustomTemplates: Record<string, string> = {};

  for (const [key, value] of Object.entries(customTemplates)) {
    if (!key.includes('/')) {
      normalizedCustomTemplates[`${key}/_template.md`] = value;
    } else {
      normalizedCustomTemplates[key] = value;
    }
  }

  const defaultTemplates: Record<string, string> = {
    'notes/_template.md': `# Note Template

## Date
{{date}}

## Topic
{{topic}}

## Notes
<!-- Your notes here -->

## Tags
<!-- Add tags for easy searching -->
`,
    'decisions/_template.md': `# Decision Record

## Date
{{date}}

## Decision
<!-- Brief description of the decision -->

## Context
<!-- Background and context -->

## Options Considered
1. Option A
2. Option B
3. Option C

## Decision Outcome
<!-- Which option was chosen and why -->

## Consequences
<!-- Positive and negative consequences -->

## Tags
<!-- decision-log, architecture, etc. -->
`,
    'playbooks/_template.md': `# Playbook

## Purpose
<!-- What this playbook achieves -->

## Prerequisites
<!-- What needs to be in place -->

## Steps
1. Step one
2. Step two
3. Step three

## Troubleshooting
<!-- Common issues and solutions -->

## Related Resources
<!-- Links to related documentation -->
`,
    'meetings/_template.md': `# Meeting Notes

## Date
{{date}}

## Attendees
<!-- List of attendees -->

## Agenda
1. Item one
2. Item two
3. Item three

## Discussion
<!-- Key discussion points -->

## Action Items
- [ ] Action item 1
- [ ] Action item 2

## Next Steps
<!-- What happens next -->
`,
  };

  const mergedTemplates = { ...defaultTemplates, ...normalizedCustomTemplates };

  for (const [relativePath, content] of Object.entries(mergedTemplates)) {
    const filePath = path.join(aiDir, relativePath);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }

  const emptyDirs = ['agents', 'meetings', 'task-summaries', 'knowledge'];
  for (const dir of emptyDirs) {
    const dirPath = path.join(aiDir, dir);
    if (fs.existsSync(dirPath)) {
      const gitkeepPath = path.join(dirPath, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '', 'utf8');
      }
    }
  }

  const readmePath = path.join(aiDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    const readmeContent = `# AI Memory & Knowledge

This directory stores persistent memory and knowledge for the AI system.

## Directory Structure

- \`notes/\` - General notes and observations
- \`decisions/\` - Architectural and technical decisions
- \`playbooks/\` - Standard operating procedures
- \`agents/\` - Agent-specific knowledge
- \`meetings/\` - Meeting notes and summaries
- \`task-summaries/\` - Execution summaries and outcomes
- \`knowledge/\` - General knowledge base

## Usage

This directory is automatically indexed and searchable by the memory retrieval system.

## Configuration

Copy \`user.json.example\` to \`user.json\` and customize for your environment.
`;
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
  }

  const userJsonExamplePath = path.join(aiDir, 'user.json.example');
  if (!fs.existsSync(userJsonExamplePath)) {
    const userJsonExample = {
      id: 'your-user-id',
      name: 'Your Name',
      email: 'your.email@example.com',
      accessLevel: 'full',
      customPermissions: [],
    };
    fs.writeFileSync(userJsonExamplePath, JSON.stringify(userJsonExample, null, 2), 'utf8');
  }

  const gitignorePath = path.join(aiDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const gitignoreContent = `# User-specific configuration
user.json

# Log files
*.log

# Temporary files
*.tmp
*.temp

# OS files
.DS_Store
Thumbs.db
`;
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
  }
}

export interface VerifyResult {
  valid: boolean;
  missing: string[];
}

export function verifyDirectoryStructure(
  aiDir: string,
  options: { checkTemplates?: boolean } = {}
): VerifyResult {
  const requiredDirs = [
    'notes',
    'decisions',
    'playbooks',
    'agents',
    'meetings',
    'task-summaries',
    'knowledge',
  ];

  const missing: string[] = [];

  if (!fs.existsSync(aiDir)) {
    return {
      valid: false,
      missing: requiredDirs,
    };
  }

  for (const dir of requiredDirs) {
    const dirPath = path.join(aiDir, dir);
    if (!fs.existsSync(dirPath)) {
      missing.push(dir);
    }
  }

  if (options.checkTemplates) {
    const templateFiles = [
      'notes/_template.md',
      'decisions/_template.md',
      'playbooks/_template.md',
      'meetings/_template.md',
    ];

    for (const templateFile of templateFiles) {
      const templatePath = path.join(aiDir, templateFile);
      if (!fs.existsSync(templatePath)) {
        missing.push(templateFile);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
