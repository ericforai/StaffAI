import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Agent, AgentFrontmatter, AgentTranslations } from './types';
import { AGENT_TRANSLATIONS } from './translations';

// Directories to scan (from the root of the agency-agents repo)
const AGENT_DIRS = [
  'design', 'engineering', 'game-development', 'marketing',
  'paid-media', 'product', 'project-management', 'testing',
  'support', 'spatial-computing', 'specialized'
];

const ROOT_DIR = path.resolve(__dirname, '../../../');

export class Scanner {
  private agents: Map<string, Agent> = new Map();

  constructor() {}

  public async scan(): Promise<Agent[]> {
    this.agents.clear();

    for (const dir of AGENT_DIRS) {
      const fullDirPath = path.join(ROOT_DIR, dir);
      if (!fs.existsSync(fullDirPath)) continue;

      await this.scanDirectory(fullDirPath, dir);
    }

    return Array.from(this.agents.values());
  }

  private async scanDirectory(dirPath: string, department: string) {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, department);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        this.parseAgentFile(fullPath, department);
      }
    }
  }

  private parseAgentFile(filePath: string, department: string) {
    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      
      // Attempt to fix some common YAML issues before parsing
      // For example, descriptions with quotes but no wrapping quotes
      const content = rawContent; 
      
      const parsed = matter(content);

      let name = parsed.data.name;
      let description = parsed.data.description;

      if (!name || !description) {
        // Fallback: try manual regex extraction if matter() fails to find fields
        const nameMatch = content.match(/^name:\s*(.*)$/m);
        const descMatch = content.match(/^description:\s*(.*)$/m);
        name = nameMatch ? nameMatch[1].trim() : '';
        description = descMatch ? descMatch[1].trim() : '';
      }

      if (!name) return;

      const slug = this.slugify(name);
      
      // Apply Chinese translations if available
      const translations = AGENT_TRANSLATIONS as AgentTranslations;
      const translation = translations[slug];
      if (translation) {
        name = translation.name;
        description = translation.description;
      }

      const agent: Agent = {
        id: slug,
        filePath,
        department,
        frontmatter: {
          ...parsed.data,
          name,
          description
        } as AgentFrontmatter,
        content: parsed.content,
        systemPrompt: this.extractSystemPrompt(parsed.content)
      };

      this.agents.set(slug, agent);
    } catch (err) {
      console.error(`Error parsing agent at ${filePath}:`, err);
    }
  }

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }

  private extractSystemPrompt(content: string): string {
    // A simple heuristic to extract the Identity and Critical Rules sections
    const lines = content.split('\n');
    let inRelevantSection = false;
    const promptLines: string[] = [];

    for (const line of lines) {
      if (line.match(/^##\s+.*(Identity|Mission|Rules|Guidelines)/i)) {
        inRelevantSection = true;
        promptLines.push(line);
      } else if (line.match(/^##\s+/) && inRelevantSection) {
        // If we hit another heading that we don't care about, stop or pause
        if (!line.match(/.*(Identity|Mission|Rules|Guidelines)/i)) {
           inRelevantSection = false;
        } else {
           promptLines.push(line);
        }
      } else if (inRelevantSection) {
        promptLines.push(line);
      }
    }

    // Fallback: If no sections found, return a subset or default
    if (promptLines.length === 0) {
      return "You are an expert AI agent. " + content.substring(0, 1000);
    }

    return promptLines.join('\n');
  }

  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}
