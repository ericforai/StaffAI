/**
 * Intent Domain Types
 */

export type IntentStatus =
  | 'intake'
  | 'clarifying'
  | 'design_ready'
  | 'design_approved'
  | 'planning'
  | 'plan_ready'
  | 'completed'
  | 'cancelled';

export type AutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface DesignSummary {
  goal: string;
  targetUser: string;
  coreFlow: string;
  scope: string;
  outOfScope: string;
  deliverables: string;
  constraints: string;
  risks: string;
}

export interface ClarificationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PlanStep {
  id: string;
  order: number;
  role: string;
  goal: string;
  input: string;
  verification: string;
  approvalRequired: boolean;
}

export interface ImplementationPlan {
  scenario: string;
  steps: PlanStep[];
  recommendedAutonomyLevel: AutonomyLevel;
  estimatedComplexity: 'Low' | 'Medium' | 'High';
}

export interface RequirementDraft {
  id: string;
  rawInput: string;
  status: IntentStatus;
  clarificationMessages: ClarificationMessage[];
  designSummary: DesignSummary | null;
  implementationPlan: ImplementationPlan | null;
  suggestedAutonomyLevel: AutonomyLevel | null;
  suggestedScenario: string | null;
  // 生成该意图的代理 ID（可选，用于自主提案）
  originatingAgentId?: string;
  confidenceScore: number;
  createdTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRecord {
  id: string;
  title: string;
  description: string;
  scenario: string;
  designSummary: DesignSummary;
  implementationPlan: ImplementationPlan;
  // 沉淀该模板的原始任务 ID（可选）
  sourceTaskId?: string;
  // 模板标签，便于分类
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceEntry {
  id: string;
  taskId: string;
  title: string;
  insight: string;
  timestamp: string;
}

export interface BehavioralHeuristic {
  id: string;
  pattern: string;
  correction: string;
  sourceTaskId: string;
  timestamp: string;
}

export interface AgentMemory {
  agentId: string;
  experienceLog: ExperienceEntry[];
  behavioralHeuristics: BehavioralHeuristic[];
  organizationalAwareness: {
    teamEvaluations: Record<string, string>;
  };
  updatedAt: string;
}

export interface KeyResult {
  id: string;
  description: string;
  targetValue: number;
  currentValueValue: number;
  metricKey: string; // e.g., 'test_coverage', 'failed_tasks_ratio'
  unit: string;
  status: 'on_track' | 'behind' | 'at_risk' | 'completed';
}

export interface OKRRecord {
  id: string;
  objective: string;
  keyResults: KeyResult[];
  ownerSquadId?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export function calculateKeyResultProgress(kr: KeyResult): number {
  if (kr.targetValue === 0) return kr.currentValueValue >= 0 ? 100 : 0;
  const progress = (kr.currentValueValue / kr.targetValue) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

export const INTENT_STATUSES: IntentStatus[] = [
  'intake',
  'clarifying',
  'design_ready',
  'design_approved',
  'planning',
  'plan_ready',
  'completed',
  'cancelled',
];

export const AUTONOMY_LEVELS: AutonomyLevel[] = ['L0', 'L1', 'L2', 'L3'];

export const INTENT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
  intake: ['clarifying', 'cancelled'],
  clarifying: ['clarifying', 'design_ready', 'cancelled'],
  design_ready: ['design_approved', 'clarifying', 'cancelled'],
  design_approved: ['planning', 'plan_ready', 'design_ready', 'cancelled'],
  planning: ['plan_ready', 'cancelled'],
  plan_ready: ['completed', 'design_approved', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isValidTransition(from: IntentStatus, to: IntentStatus): boolean {
  return INTENT_TRANSITIONS[from].includes(to);
}
