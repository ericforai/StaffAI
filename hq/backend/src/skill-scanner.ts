import fs from 'fs';
import os from 'os';
import path from 'path';
import matter from 'gray-matter';
import { Skill, SkillFrontmatter, SkillHost, SkillInstallation } from './types';

interface SkillRoot {
  host: SkillHost;
  rootPath: string;
  scope: 'global' | 'project';
}

const ROOT_DIR = path.resolve(__dirname, '../../../');
const MAX_SCAN_DEPTH = 3;
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'docs',
  'test',
  'tests',
  'scripts',
  'bin',
  'browse',
  'supabase',
  'backups',
  'sessions',
]);
const SKIP_NESTED_SEGMENTS = new Set(['.agents', '.claude', '.codex']);

export class SkillScanner {
  private skills: Map<string, Skill> = new Map();

  public async scan(): Promise<Skill[]> {
    this.skills.clear();

    for (const root of this.getSkillRoots()) {
      if (!fs.existsSync(root.rootPath)) {
        continue;
      }

      await this.scanDirectory(root, root.rootPath, 0);
    }

    return this.getAllSkills();
  }

  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  private getSkillRoots(): SkillRoot[] {
    const homeDir = os.homedir();
    return [
      { host: 'claude', rootPath: path.join(homeDir, '.claude/skills'), scope: 'global' },
      { host: 'codex', rootPath: path.join(homeDir, '.codex/skills'), scope: 'global' },
      { host: 'agents', rootPath: path.join(homeDir, '.agents/skills'), scope: 'global' },
      { host: 'project-claude', rootPath: path.join(ROOT_DIR, '.claude/skills'), scope: 'project' },
      { host: 'project-agents', rootPath: path.join(ROOT_DIR, '.agents/skills'), scope: 'project' },
    ];
  }

  private async scanDirectory(root: SkillRoot, currentDir: string, depth: number): Promise<void> {
    if (depth > MAX_SCAN_DEPTH || this.shouldSkipDir(root.rootPath, currentDir, depth)) {
      return;
    }

    const skillFilePath = path.join(currentDir, 'SKILL.md');
    if (fs.existsSync(skillFilePath) && fs.statSync(skillFilePath).isFile()) {
      this.parseSkillFile(root, skillFilePath);
    }

    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      await this.scanDirectory(root, path.join(currentDir, entry.name), depth + 1);
    }
  }

  private shouldSkipDir(rootPath: string, currentDir: string, depth: number): boolean {
    const baseName = path.basename(currentDir);
    if (depth > 0 && SKIP_DIRS.has(baseName)) {
      return true;
    }

    const relativeDir = path.relative(rootPath, currentDir);
    if (!relativeDir || relativeDir === '.') {
      return false;
    }

    const segments = relativeDir.split(path.sep);
    return segments.slice(0, -1).some((segment) => SKIP_NESTED_SEGMENTS.has(segment));
  }

  private parseSkillFile(root: SkillRoot, filePath: string): void {
    const rawContent = fs.readFileSync(filePath, 'utf-8');

    try {
      const parsed = matter(rawContent);
      this.storeSkill(root, filePath, parsed.data as SkillFrontmatter);
      return;
    } catch (error) {
      const fallback = this.extractFallbackFrontmatter(rawContent);
      if (fallback) {
        this.storeSkill(root, filePath, fallback);
        return;
      }

      console.error(`Error parsing skill at ${filePath}:`, error);
    }
  }

  private storeSkill(root: SkillRoot, filePath: string, data: SkillFrontmatter): void {
    const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : path.basename(path.dirname(filePath));
    const description =
      typeof data.description === 'string' && data.description.trim()
        ? data.description.trim()
        : 'No description provided.';
    const allowedTools = Array.isArray(data['allowed-tools'])
      ? data['allowed-tools'].filter((tool): tool is string => typeof tool === 'string')
      : [];

    const id = this.slugify(path.relative(root.rootPath, path.dirname(filePath)).replaceAll(path.sep, '-'));
    const installation: SkillInstallation = {
      host: root.host,
      rootPath: root.rootPath,
      filePath,
      scope: root.scope,
    };

    const existing = this.skills.get(id);
    if (existing) {
      existing.installations.push(installation);
      existing.allowedTools = Array.from(new Set([...existing.allowedTools, ...allowedTools]));
      return;
    }

    this.skills.set(id, {
      id,
      name,
      description,
      version: typeof data.version === 'string' ? data.version : undefined,
      allowedTools,
      installations: [installation],
    });
  }

  private extractFallbackFrontmatter(content: string): SkillFrontmatter | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const extract = (field: string) => {
      const match = frontmatter.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
      return match ? match[1].trim() : undefined;
    };

    const name = extract('name');
    const description = extract('description');
    if (!name && !description) {
      return null;
    }

    return {
      name,
      description,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}
