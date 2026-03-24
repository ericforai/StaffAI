export interface AgentFrontmatter {
  name: string;
  description: string;
  color?: string;
  emoji?: string;
  vibe?: string;
  tools?: string;
}

export interface Agent {
  id: string;
  department: string;
  frontmatter: AgentFrontmatter;
}

export interface SquadState {
  activeAgentIds: string[];
}
