export interface AgentFrontmatter {
  name: string;
  description: string;
  color?: string;
  emoji?: string;
  vibe?: string;
  tools?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export type AgentTaskType =
  | 'architecture'
  | 'architecture_analysis'
  | 'backend_implementation'
  | 'backend_design'
  | 'code_review'
  | 'documentation'
  | 'workflow_dispatch'
  | 'frontend_implementation'
  | 'quality_assurance'
  | 'general';

export type AgentRiskScope = 'low' | 'medium' | 'high';

export interface AgentExecutionPreference {
  preferredMode: 'single' | 'serial' | 'parallel' | 'advanced_discussion';
  preferredExecutor: 'claude' | 'codex' | 'openai' | 'auto';
  supportsParallelWork: boolean;
  discussionCapable: boolean;
}

export interface AgentOutputContract {
  primaryFormat: 'markdown' | 'json' | 'checklist' | 'code' | 'mixed';
  sections: string[];
}

export interface AgentCapability {
  role: string;
  responsibilities: string[];
  tools: string[];
  allowedTaskTypes: AgentTaskType[];
  riskScope: AgentRiskScope;
  executionPreferences: AgentExecutionPreference;
  outputContract: AgentOutputContract;
}

export interface AgentProfile extends AgentCapability {
  id: string;
  name: string;
  department: string;
}

export interface Agent {
  id: string; // The slug, e.g., 'frontend-developer'
  filePath: string;
  department: string;
  frontmatter: AgentFrontmatter;
  content: string; // The full body
  systemPrompt: string; // Extracted identity and critical rules
  profile?: AgentProfile;
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

// ─────────────────────────────────────────────
// CRM Domain Types
// ─────────────────────────────────────────────

export type ContactStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type DealStage =
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface CrmContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyId?: string;
  companyName?: string;
  title?: string;
  stage: ContactStage;
  tags: string[];
  notes?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCompany {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  employeeCount?: number;
  annualRevenue?: number;
  tags: string[];
  notes?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: DealStage;
  contactId?: string;
  contactName?: string;
  companyId?: string;
  companyName?: string;
  expectedCloseDate?: string;
  probability?: number;
  tags: string[];
  notes?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  description?: string;
  contactId?: string;
  contactName?: string;
  companyId?: string;
  companyName?: string;
  dealId?: string;
  dealTitle?: string;
  date: string;
  duration?: number; // minutes, for calls/meetings
  ownerId?: string;
  createdAt: string;
}
