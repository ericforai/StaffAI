import type { TaskPriority, TaskRouteDecision, TaskRouteInput, TaskType } from '../shared/task-types';

interface RouteRule {
  taskType: TaskType;
  priority?: TaskPriority;
  keywords: string[];
  recommendedAgentRole: string;
  candidateAgentRoles: string[];
  reason: string;
  executionMode: TaskRouteDecision['executionMode'];
}

const ROUTE_RULES: RouteRule[] = [
  {
    taskType: 'architecture',
    keywords: ['architect', 'architecture', 'boundary', 'bounded context', 'refactor', 'design', 'ddd', 'modular'],
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect', 'dispatcher'],
    reason: 'Architecture and boundary work should start from system design ownership.',
    executionMode: 'serial',
  },
  {
    taskType: 'backend_implementation',
    keywords: ['backend', 'api', 'database', 'migration', 'repository', 'service', 'orchestrator'],
    recommendedAgentRole: 'backend-architect',
    candidateAgentRoles: [
      'dispatcher',
      'software-architect',
      'backend-architect',
      'code-reviewer',
      'technical-writer',
    ],
    reason: 'Backend and API work should route to backend implementation ownership with review follow-up.',
    executionMode: 'serial',
  },
  {
    taskType: 'frontend_implementation',
    keywords: ['frontend', 'ui', 'page', 'component', 'react', 'next.js', 'dashboard'],
    recommendedAgentRole: 'frontend-developer',
    candidateAgentRoles: [
      'dispatcher',
      'software-architect',
      'frontend-developer',
      'code-reviewer',
      'technical-writer',
    ],
    reason: 'UI work should route to frontend implementation ownership.',
    executionMode: 'serial',
  },
  {
    taskType: 'code_review',
    keywords: ['review', 'risk', 'audit', 'regression', 'bug risk'],
    recommendedAgentRole: 'code-reviewer',
    candidateAgentRoles: ['code-reviewer'],
    reason: 'Review and risk work should route directly to reviewer ownership.',
    executionMode: 'single',
  },
  {
    taskType: 'documentation',
    keywords: ['docs', 'documentation', 'guide', 'manual', 'spec', 'readme', 'tutorial'],
    recommendedAgentRole: 'technical-writer',
    candidateAgentRoles: ['technical-writer'],
    reason: 'Documentation work should route to technical writing ownership.',
    executionMode: 'single',
  },
  {
    taskType: 'workflow_dispatch',
    keywords: ['split', 'orchestrate', 'coordinate', 'workflow', 'dispatch', 'delegate'],
    recommendedAgentRole: 'dispatcher',
    candidateAgentRoles: ['dispatcher', 'software-architect'],
    reason: 'Coordination and decomposition work should route to dispatcher ownership.',
    executionMode: 'parallel',
  },
  {
    taskType: 'feature_delivery',
    keywords: ['delivery', 'feature', 'end-to-end', '全流程', '交付', 'requirement delivery', 'sprint'],
    recommendedAgentRole: 'sprint-prioritizer',
    candidateAgentRoles: [
      'sprint-prioritizer',
      'software-architect',
      'frontend-developer',
      'backend-architect',
      'security-engineer',
      'code-reviewer',
    ],
    reason: 'End-to-end feature delivery requires multi-role coordination starting from requirements.',
    executionMode: 'serial',
  },
];

function inferDefaultTaskType(input: TaskRouteInput): TaskType | undefined {
  return input.taskType;
}

function matchesKeyword(haystack: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return haystack.includes(keyword);
  }

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(haystack);
}

export function recommendTaskRoute(input: TaskRouteInput): TaskRouteDecision {
  const haystack = `${input.title} ${input.description}`.toLowerCase();
  const explicitTaskType = inferDefaultTaskType(input);

  for (const rule of ROUTE_RULES) {
    if (explicitTaskType && explicitTaskType === rule.taskType) {
      return {
        taskType: rule.taskType,
        recommendedAgentRole: rule.recommendedAgentRole,
        candidateAgentRoles: rule.candidateAgentRoles,
        reason: rule.reason,
        routingStatus: 'matched',
        executionMode: rule.executionMode,
      };
    }

    if (rule.keywords.some((keyword) => matchesKeyword(haystack, keyword))) {
      return {
        taskType: rule.taskType,
        recommendedAgentRole: rule.recommendedAgentRole,
        candidateAgentRoles: rule.candidateAgentRoles,
        reason: rule.reason,
        routingStatus: 'matched',
        executionMode: rule.executionMode,
      };
    }
  }

  return {
    taskType: explicitTaskType || 'general',
    recommendedAgentRole: 'dispatcher',
    candidateAgentRoles: ['dispatcher'],
    reason: 'No strong route match was found, so dispatcher should triage the task.',
    routingStatus: 'manual_review',
    executionMode: 'single',
  };
}
