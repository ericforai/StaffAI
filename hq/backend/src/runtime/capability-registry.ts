import type { Agent } from '../types';

export interface CapabilityDefinition {
  id:
    | 'discussion.orchestrate'
    | 'discussion.consult'
    | 'host.inject'
    | 'agent.discover'
    | 'skill.discover'
    | 'executor.claude'
    | 'executor.codex'
    | 'executor.openai'
    | 'workflow.recommend';
  label: string;
  description: string;
}

export interface BoundAgentCapabilities {
  agentId: string;
  capabilities: string[];
}

const CAPABILITY_DEFINITIONS = [
  ['discussion.orchestrate', 'Discussion Orchestration', 'Coordinate multi-agent discussions and syntheses.'],
  ['discussion.consult', 'Single Expert Consult', 'Route a task to the best matching expert.'],
  ['host.inject', 'Host Injection', 'Generate and apply host-specific instruction snippets.'],
  ['agent.discover', 'Agent Discovery', 'Scan and index local agency experts.'],
  ['skill.discover', 'Skill Discovery', 'Scan and index local skills and capabilities.'],
  ['executor.claude', 'Claude Executor', 'Run work through the local Claude executor.'],
  ['executor.codex', 'Codex Executor', 'Run work through the local Codex executor.'],
  ['executor.openai', 'OpenAI Executor', 'Fallback to OpenAI API execution when configured.'],
  ['workflow.recommend', 'Workflow Recommendation', 'Recommend next actions based on task stage and runtime state.'],
] as const satisfies ReadonlyArray<readonly [CapabilityDefinition['id'], string, string]>;

export function createCapabilityRegistry(): CapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS.map(([id, label, description]) => ({
    id,
    label,
    description,
  }));
}

export function bindAgentCapabilities(agent: Agent): BoundAgentCapabilities {
  const capabilities = new Set<string>(['discussion.consult']);
  const tools = (agent.frontmatter.tools || '').toLowerCase();

  if (agent.department === 'engineering' || agent.department === 'testing') {
    capabilities.add('workflow.recommend');
  }

  if (tools.includes('review') || tools.includes('ship')) {
    capabilities.add('executor.codex');
  }

  if (tools.includes('claude')) {
    capabilities.add('executor.claude');
  }

  if (tools.includes('openai')) {
    capabilities.add('executor.openai');
  }

  return {
    agentId: agent.id,
    capabilities: Array.from(capabilities),
  };
}
