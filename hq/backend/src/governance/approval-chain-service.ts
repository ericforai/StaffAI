/**
 * Approval Chain Service (GAP-6)
 *
 * Manages multi-step approval chain workflow for task governance.
 * Chains progress sequentially through approval steps based on risk level.
 */

import type {
  ApprovalChain,
  ApprovalChainStep,
} from '../shared/approval-chain-types.js';
import { DEFAULT_CHAINS } from '../shared/approval-chain-types.js';

/**
 * In-memory storage for active approval chains
 * Key: taskId, Value: ApprovalChain
 */
const chainStore = new Map<string, ApprovalChain>();

/**
 * Risk level mapping to chain templates
 */
const CHAIN_SELECTOR: Record<string, keyof typeof DEFAULT_CHAINS> = {
  LOW: 'standard',
  MEDIUM: 'elevated',
  HIGH: 'strict',
};

/**
 * Create a new approval chain for a task based on risk level
 *
 * @param taskId - Task identifier
 * @param riskLevel - Risk level (LOW | MEDIUM | HIGH)
 * @returns New approval chain
 */
export function createChain(
  taskId: string,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
): ApprovalChain {
  const chainType = CHAIN_SELECTOR[riskLevel];
  const stepTemplates = DEFAULT_CHAINS[chainType];

  // Deep copy steps to avoid mutation of templates
  const steps: ApprovalChainStep[] = stepTemplates.map((step) => ({
    ...step,
    status: 'pending' as const,
  }));

  const chain: ApprovalChain = {
    taskId,
    steps,
    currentStep: 0,
    status: 'in_progress',
  };

  chainStore.set(taskId, chain);
  return chain;
}

/**
 * Advance an approval chain by processing the current step
 *
 * @param taskId - Task identifier
 * @param approverRole - Role of the approver (must match current step role)
 * @param decision - Approval decision ('approve' | 'reject')
 * @param comment - Optional comment from approver
 * @returns Updated approval chain
 * @throws Error if chain not found, role mismatch, or invalid state
 */
export function advanceChain(
  taskId: string,
  approverRole: string,
  decision: 'approve' | 'reject',
  comment?: string
): ApprovalChain {
  const chain = chainStore.get(taskId);
  if (!chain) {
    throw new Error(`Approval chain not found for task: ${taskId}`);
  }

  if (chain.status !== 'in_progress') {
    throw new Error(
      `Cannot advance chain with status: ${chain.status} for task: ${taskId}`
    );
  }

  const currentStepIndex = chain.currentStep;
  if (currentStepIndex >= chain.steps.length) {
    throw new Error(`No pending steps for task: ${taskId}`);
  }

  const currentStep = chain.steps[currentStepIndex];

  // Verify role matches
  if (currentStep.role !== approverRole) {
    throw new Error(
      `Role mismatch: expected '${currentStep.role}', got '${approverRole}' for step ${currentStep.stepNumber}`
    );
  }

  // Update step status
  const updatedStep: ApprovalChainStep = {
    ...currentStep,
    status: decision === 'approve' ? 'approved' : 'rejected',
    approver: approverRole,
    comment,
    resolvedAt: new Date().toISOString(),
  };

  // Update chain with resolved step
  const updatedSteps = [...chain.steps];
  updatedSteps[currentStepIndex] = updatedStep;

  let newStatus: ApprovalChain['status'] = 'in_progress';
  let newCurrentStep = currentStepIndex;

  if (decision === 'reject') {
    // Any rejection marks chain as rejected
    newStatus = 'rejected';
  } else if (currentStepIndex === chain.steps.length - 1) {
    // Last step approved - chain complete
    newStatus = 'completed';
  } else {
    // Move to next step
    newCurrentStep = currentStepIndex + 1;
  }

  const updatedChain: ApprovalChain = {
    ...chain,
    steps: updatedSteps,
    currentStep: newCurrentStep,
    status: newStatus,
  };

  chainStore.set(taskId, updatedChain);
  return updatedChain;
}

/**
 * Get approval chain for a task
 *
 * @param taskId - Task identifier
 * @returns Approval chain or undefined if not found
 */
export function getChain(taskId: string): ApprovalChain | undefined {
  return chainStore.get(taskId);
}

/**
 * Check if an approval chain is complete
 *
 * @param taskId - Task identifier
 * @returns true if chain exists and status is 'completed'
 */
export function isChainComplete(taskId: string): boolean {
  const chain = chainStore.get(taskId);
  return chain?.status === 'completed';
}

/**
 * Delete an approval chain (cleanup utility)
 *
 * @param taskId - Task identifier
 * @returns true if chain was deleted, false if not found
 */
export function deleteChain(taskId: string): boolean {
  return chainStore.delete(taskId);
}

/**
 * Get all active chains (utility for debugging/monitoring)
 *
 * @returns Array of all approval chains
 */
export function getAllChains(): ApprovalChain[] {
  return Array.from(chainStore.values());
}

/**
 * Clear all chains (utility for testing)
 */
export function clearAllChains(): void {
  chainStore.clear();
}
