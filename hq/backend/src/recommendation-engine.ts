import type { HostCapabilityLevel, HostId, ExecutorName } from './host-adapters';

export type WorkflowStage = 'brainstorm' | 'review' | 'debug' | 'ship' | 'consult';

export interface RecommendationItem {
  action: 'run_expert_discussion' | 'inspect_host_injection' | 'fallback_to_web_ui' | 'switch_to_serial' | 'hire_experts';
  label: string;
  reason: string;
}

export interface RecommendationInput {
  topic: string;
  hostId: HostId;
  capabilityLevel: HostCapabilityLevel;
  availableExecutors: ExecutorName[];
  samplingEnabled: boolean;
  activeAgentIds: string[];
}

export interface RecommendationResult {
  stage: WorkflowStage;
  degraded: boolean;
  recommendations: RecommendationItem[];
}

export function detectWorkflowStage(topic: string): WorkflowStage {
  const normalized = topic.toLowerCase();

  if (normalized.includes('review') || normalized.includes('diff') || normalized.includes('merge')) {
    return 'review';
  }

  if (normalized.includes('debug') || normalized.includes('broken') || normalized.includes('investigate')) {
    return 'debug';
  }

  if (normalized.includes('ship') || normalized.includes('release') || normalized.includes('deploy')) {
    return 'ship';
  }

  if (normalized.includes('brainstorm') || normalized.includes('idea') || normalized.includes('plan')) {
    return 'brainstorm';
  }

  return 'consult';
}

export function buildRecommendations(input: RecommendationInput): RecommendationResult {
  const stage = detectWorkflowStage(input.topic);
  const degraded = input.capabilityLevel !== 'full' || input.availableExecutors.length === 0 || !input.samplingEnabled;
  const recommendations: RecommendationItem[] = [];

  recommendations.push({
    action: 'inspect_host_injection',
    label: 'Inspect host injection',
    reason: `Verify that ${input.hostId} is using the generated Agency instructions.`,
  });

  if (stage === 'review' || stage === 'ship' || input.activeAgentIds.length > 0) {
    recommendations.push({
      action: 'run_expert_discussion',
      label: 'Run expert discussion',
      reason: 'Use the roster to synthesize expert feedback before executing.',
    });
  }

  if (input.activeAgentIds.length === 0) {
    recommendations.push({
      action: 'hire_experts',
      label: 'Hire experts',
      reason: 'No active experts are selected for the current workflow.',
    });
  }

  if (!input.samplingEnabled && input.availableExecutors.length > 0) {
    recommendations.push({
      action: 'switch_to_serial',
      label: 'Switch to serial execution',
      reason: 'Sampling is unavailable, so serial execution is the safest fallback.',
    });
  }

  if (degraded) {
    recommendations.push({
      action: 'fallback_to_web_ui',
      label: 'Fallback to Web UI',
      reason: 'Current host/runtime support is partial, so the Web UI is the most reliable control surface.',
    });
  }

  return {
    stage,
    degraded,
    recommendations,
  };
}
