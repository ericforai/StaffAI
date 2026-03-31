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
  confidenceScore: number;
  createdTaskId: string | null;
  createdAt: string;
  updatedAt: string;
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
