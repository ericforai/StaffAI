/**
 * Approval Chain Types (GAP-6)
 *
 * Multi-step approval chain workflow for task governance.
 * Chains progress sequentially through steps based on risk level.
 */

/**
 * Individual step in an approval chain
 */
export interface ApprovalChainStep {
  /** Sequential step number (1-indexed) */
  stepNumber: number;
  /** Role responsible for this approval step */
  role: string;
  /** Whether this step can be skipped (not used in current implementation) */
  required: boolean;
  /** Auto-approve if task is low risk (only for step 1 in elevated chain) */
  autoApproveIfLowRisk: boolean;
  /** Current status of this step */
  status: 'pending' | 'approved' | 'rejected';
  /** ID of the approver who resolved this step */
  approver?: string;
  /** Optional comment from approver */
  comment?: string;
  /** ISO timestamp when step was resolved */
  resolvedAt?: string;
}

/**
 * Complete approval chain for a task
 */
export interface ApprovalChain {
  /** Associated task ID */
  taskId: string;
  /** All steps in the chain */
  steps: ApprovalChainStep[];
  /** Current step index (0-indexed, points to next pending step) */
  currentStep: number;
  /** Overall chain status */
  status: 'in_progress' | 'completed' | 'rejected';
}

/**
 * Preset approval chain templates
 */
export const DEFAULT_CHAINS: Record<string, ApprovalChainStep[]> = {
  /**
   * Standard chain - single approval step for low-risk tasks
   */
  standard: [
    {
      stepNumber: 1,
      role: 'team_lead',
      required: true,
      autoApproveIfLowRisk: false,
      status: 'pending',
    },
  ],

  /**
   * Elevated chain - two-step approval for medium-risk tasks
   * Step 1 auto-approves if low risk (downgrade path)
   */
  elevated: [
    {
      stepNumber: 1,
      role: 'team_lead',
      required: true,
      autoApproveIfLowRisk: true,
      status: 'pending',
    },
    {
      stepNumber: 2,
      role: 'manager',
      required: true,
      autoApproveIfLowRisk: false,
      status: 'pending',
    },
  ],

  /**
   * Strict chain - three-step approval for high-risk tasks
   * All steps required, no auto-approval
   */
  strict: [
    {
      stepNumber: 1,
      role: 'team_lead',
      required: true,
      autoApproveIfLowRisk: false,
      status: 'pending',
    },
    {
      stepNumber: 2,
      role: 'manager',
      required: true,
      autoApproveIfLowRisk: false,
      status: 'pending',
    },
    {
      stepNumber: 3,
      role: 'compliance',
      required: true,
      autoApproveIfLowRisk: false,
      status: 'pending',
    },
  ],
};
