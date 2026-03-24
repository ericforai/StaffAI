import type { Agent } from './types';

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

export function createCapabilityRegistry(): CapabilityDefinition[] {
  return [
    {
      id: 'discussion.orchestrate',
      label: 'Discussion Orchestration',
      description: 'Coordinate multi-agent discussions and syntheses.',
    },
    {
      id: 'discussion.consult',
      label: 'Single Expert Consult',
      description: 'Route a task to the best matching expert.',
    },
    {
      id: 'host.inject',
      label: 'Host Injection',
      description: 'Generate and apply host-specific instruction snippets.',
    },
    {
      id: 'agent.discover',
      label: 'Agent Discovery',
      description: 'Scan and index local agency experts.',
    },
    {
      id: 'skill.discover',
      label: 'Skill Discovery',
      description: 'Scan and index local skills and capabilities.',
    },
    {
      id: 'executor.claude',
      label: 'Claude Executor',
      description: 'Run work through the local Claude executor.',
    },
    {
      id: 'executor.codex',
      label: 'Codex Executor',
      description: 'Run work through the local Codex executor.',
    },
    {
      id: 'executor.openai',
      label: 'OpenAI Executor',
      description: 'Fallback to OpenAI API execution when configured.',
    },
    {
      id: 'workflow.recommend',
      label: 'Workflow Recommendation',
      description: 'Recommend next actions based on task stage and runtime state.',
    },
  ];
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
