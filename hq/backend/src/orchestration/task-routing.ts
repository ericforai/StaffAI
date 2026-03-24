import { TaskRouteDecision, TaskRouteInput } from '../shared/task-types';

const ROUTE_RULES: Array<{
  keywords: string[];
  recommendedAgentRole: string;
}> = [
  {
    keywords: ['architect', 'architecture', 'boundary', 'boundaries', 'refactor', 'design'],
    recommendedAgentRole: 'software-architect',
  },
  {
    keywords: ['document', 'documentation', 'guide', 'manual', 'spec', 'workflow'],
    recommendedAgentRole: 'technical-writer',
  },
];

export function recommendTaskRoute(input: TaskRouteInput): TaskRouteDecision {
  const haystack = `${input.title} ${input.description}`.toLowerCase();

  for (const rule of ROUTE_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return {
        recommendedAgentRole: rule.recommendedAgentRole,
        routingStatus: 'matched',
        executionMode: 'single',
      };
    }
  }

  return {
    recommendedAgentRole: 'dispatcher',
    routingStatus: 'manual_review',
    executionMode: 'single',
  };
}
