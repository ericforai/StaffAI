import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type {
  Agent,
  AgentCapability,
  AgentExecutionPreference,
  AgentFrontmatter,
  AgentOutputContract,
  AgentProfile,
  AgentTaskType,
  AgentTranslations,
} from './types';
import { AGENT_TRANSLATIONS } from './translations';

// Directories to scan (from the root of the agency-agents repo)
const AGENT_DIRS = [
  'design', 'engineering', 'game-development', 'marketing',
  'paid-media', 'product', 'project-management', 'testing',
  'support', 'spatial-computing', 'specialized',
  'hq/generated/employees',
];

const ROOT_DIR = path.resolve(__dirname, '../../../');

const DEFAULT_TOOLS_BY_ROLE: Record<string, string[]> = {
  'software-architect': ['docs_search', 'git_diff', 'file_read', 'runtime_executor'],
  'backend-architect': ['docs_search', 'git_diff', 'file_read', 'runtime_executor', 'test_runner'],
  'frontend-developer': ['docs_search', 'git_diff', 'file_read', 'runtime_executor'],
  'technical-writer': ['docs_search', 'git_diff', 'file_read'],
  'code-reviewer': ['git_diff', 'file_read', 'docs_search'],
  dispatcher: ['docs_search', 'runtime_executor'],
};

const DEFAULT_TASK_TYPES_BY_ROLE: Record<string, AgentTaskType[]> = {
  'software-architect': ['architecture', 'architecture_analysis', 'workflow_dispatch', 'general'],
  'backend-architect': ['backend_implementation', 'architecture', 'architecture_analysis', 'general'],
  'frontend-developer': ['frontend_implementation', 'general'],
  'technical-writer': ['documentation', 'general'],
  'code-reviewer': ['code_review', 'quality_assurance', 'general'],
  dispatcher: ['workflow_dispatch', 'general'],
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

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
        systemPrompt: this.extractSystemPrompt(parsed.content),
        profile: this.buildAgentProfile({
          id: slug,
          department,
          frontmatter: {
            ...parsed.data,
            name,
            description,
          } as AgentFrontmatter,
          content: parsed.content,
        }),
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

  private buildAgentProfile(input: {
    id: string;
    department: string;
    frontmatter: AgentFrontmatter;
    content: string;
  }): AgentProfile {
    const role = this.inferRole(input.id, input.department, input.content);
    const responsibilities = this.extractResponsibilities(input.content);
    const tools = this.extractTools(input.frontmatter, role, input.content);
    const allowedTaskTypes = this.inferAllowedTaskTypes(role, input.content);
    const executionPreferences = this.inferExecutionPreferences(role, input.content);
    const outputContract = this.inferOutputContract(input.content);

    return {
      id: input.id,
      name: input.frontmatter.name,
      department: input.department,
      role,
      responsibilities,
      tools,
      allowedTaskTypes,
      riskScope: this.inferRiskScope(role, input.content),
      executionPreferences,
      outputContract,
    };
  }

  private inferRole(id: string, department: string, content: string): string {
    if (id.includes('software-architect')) return 'software-architect';
    if (id.includes('backend')) return 'backend-architect';
    if (id.includes('frontend')) return 'frontend-developer';
    if (id.includes('technical-writer')) return 'technical-writer';
    if (id.includes('reviewer')) return 'code-reviewer';
    if (content.toLowerCase().includes('code review')) return 'code-reviewer';
    if (department === 'product' || content.toLowerCase().includes('documentation')) return 'technical-writer';
    return 'dispatcher';
  }

  private extractResponsibilities(content: string): string[] {
    const lines = content.split('\n');
    const responsibilities: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
        const value = normalizeWhitespace(trimmed.replace(/^-\s+/, '').replace(/^\d+\.\s+/, ''));
        if (value && value.length <= 160) {
          responsibilities.push(value);
        }
      }

      if (responsibilities.length >= 8) {
        break;
      }
    }

    return responsibilities.length > 0 ? responsibilities : ['Deliver the role-specific task outcome with clear reasoning.'];
  }

  private extractTools(frontmatter: AgentFrontmatter, role: string, content: string): string[] {
    const fromFrontmatter =
      typeof frontmatter.tools === 'string'
        ? frontmatter.tools
            .split(/[,\n]/)
            .map((entry) => normalizeWhitespace(entry))
            .filter(Boolean)
        : [];

    const inferred = [...(DEFAULT_TOOLS_BY_ROLE[role] || DEFAULT_TOOLS_BY_ROLE.dispatcher)];
    if (/test/i.test(content)) {
      inferred.push('test_runner');
    }

    return Array.from(new Set([...fromFrontmatter, ...inferred]));
  }

  private inferAllowedTaskTypes(role: string, content: string): AgentTaskType[] {
    const allowed = [...(DEFAULT_TASK_TYPES_BY_ROLE[role] || DEFAULT_TASK_TYPES_BY_ROLE.dispatcher)];
    const lower = content.toLowerCase();

    if (lower.includes('api') || lower.includes('database') || lower.includes('backend')) {
      allowed.push('backend_implementation');
    }
    if (lower.includes('review')) {
      allowed.push('code_review');
    }
    if (lower.includes('document') || lower.includes('readme')) {
      allowed.push('documentation');
    }

    return Array.from(new Set(allowed));
  }

  private inferRiskScope(role: string, content: string): AgentCapability['riskScope'] {
    if (role === 'dispatcher' || role === 'code-reviewer') {
      return 'medium';
    }
    if (/security|incident|threat/i.test(content)) {
      return 'high';
    }
    return 'low';
  }

  private inferExecutionPreferences(role: string, content: string): AgentExecutionPreference {
    const lower = content.toLowerCase();
    const discussionCapable = /discussion|synthesis|trade-off/.test(lower) || role === 'software-architect' || role === 'dispatcher';
    const supportsParallelWork = discussionCapable || /parallel|concurrent/.test(lower);

    return {
      preferredMode: discussionCapable ? 'serial' : 'single',
      preferredExecutor: role === 'technical-writer' ? 'claude' : 'codex',
      supportsParallelWork,
      discussionCapable,
    };
  }

  private inferOutputContract(content: string): AgentOutputContract {
    const headingMatches = Array.from(content.matchAll(/^##+\s+(.+)$/gm)).map((match) => normalizeWhitespace(match[1]));
    const sections = headingMatches.slice(0, 6);
    const lower = content.toLowerCase();

    return {
      primaryFormat: /```/.test(content) ? 'mixed' : lower.includes('json') ? 'json' : 'markdown',
      sections: sections.length > 0 ? sections : ['Summary', 'Approach', 'Deliverables'],
    };
  }

  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}
