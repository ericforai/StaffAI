export interface AgentFrontmatter {
  name: string;
  description: string;
  color?: string;
  emoji?: string;
  vibe?: string;
  tools?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface Agent {
  id: string; // The slug, e.g., 'frontend-developer'
  filePath: string;
  department: string;
  frontmatter: AgentFrontmatter;
  content: string; // The full body
  systemPrompt: string; // Extracted identity and critical rules
}

export interface SquadState {
  activeAgentIds: string[];
}

export interface AgentTranslation {
  name: string;
  description: string;
}

export interface AgentTranslations {
  [slug: string]: AgentTranslation;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  'allowed-tools'?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
}

export type SkillHost = 'claude' | 'codex' | 'agents' | 'project-claude' | 'project-agents';

export interface SkillInstallation {
  host: SkillHost;
  rootPath: string;
  filePath: string;
  scope: 'global' | 'project';
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version?: string;
  allowedTools: string[];
  installations: SkillInstallation[];
}
