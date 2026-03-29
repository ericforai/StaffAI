/**
 * Self-Healing Service for Workflow Execution
 *
 * Provides automatic retry with checkpoint-based recovery and agent replacement
 * when workflow steps fail during execution.
 */

import type { Agent } from '../types';
import type { Scanner } from '../scanner';

/**
 * Strategy for healing a failed step
 */
export type HealingStrategy = 'retry' | 'replace_agent' | 'abandon';

/**
 * Configuration for self-healing behavior
 */
export interface SelfHealingConfig {
  /**
   * Maximum number of retry attempts per step
   */
  maxRetries: number;

  /**
   * Delay between retry attempts in milliseconds
   */
  retryDelayMs: number;

  /**
   * Whether to enable agent replacement on retry exhaustion
   */
  enableAgentReplacement: boolean;

  /**
   * Whether to enable checkpoint-based recovery
   */
  enableCheckpointRecovery: boolean;
}

/**
 * Record of a healing attempt
 */
export interface HealingAttempt {
  /**
   * Attempt number (1-indexed)
   */
  attemptNumber: number;

  /**
   * ID of the task being executed
   */
  taskId: string;

  /**
   * ID of the workflow step that failed
   */
  stepId: string;

  /**
   * ID of the assignment that failed
   */
  assignmentId: string;

  /**
   * Error that caused the failure
   */
  error: Error;

  /**
   * Timestamp of the attempt
   */
  timestamp: string;

  /**
   * Strategy used for this attempt
   */
  strategy: HealingStrategy;

  /**
   * ID of the original agent that failed
   */
  originalAgentId: string;

  /**
   * ID of the replacement agent (if strategy was 'replace_agent')
   */
  replacementAgentId?: string;

  /**
   * Whether the attempt succeeded
   */
  success: boolean;

  /**
   * Output summary if successful
   */
  outputSummary?: string;

  /**
   * Output snapshot if successful
   */
  outputSnapshot?: Record<string, unknown>;
}

/**
 * Checkpoint data for workflow recovery
 */
export interface WorkflowCheckpoint {
  /**
   * ID of the workflow plan
   */
  workflowPlanId: string;

  /**
   * ID of the task
   */
  taskId: string;

  /**
   * Completed step IDs
   */
  completedSteps: string[];

  /**
   * Current step ID (if any)
   */
  currentStep?: string;

  /**
   * Timestamp of the checkpoint
   */
  timestamp: string;

  /**
   * Context data for recovery
   */
  context?: Record<string, unknown>;
}

/**
 * Result of a healing operation
 */
export interface HealingResult {
  /**
   * Whether healing was successful
   */
  success: boolean;

  /**
   * Strategy that was used
   */
  strategy: HealingStrategy;

  /**
   * Output summary if successful
   */
  outputSummary?: string;

  /**
   * Output snapshot if successful
   */
  outputSnapshot?: Record<string, unknown>;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * ID of the replacement agent (if applicable)
   */
  replacementAgentId?: string;

  /**
   * Number of attempts made
   */
  attempts: number;
}

/**
 * Default configuration for self-healing
 */
export const DEFAULT_SELF_HEALING_CONFIG: SelfHealingConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  enableAgentReplacement: true,
  enableCheckpointRecovery: true,
};

/**
 * Service for managing self-healing of workflow executions
 */
export class SelfHealingService {
  private readonly config: SelfHealingConfig;
  private readonly scanner?: Scanner;
  private readonly healingAttempts = new Map<string, HealingAttempt[]>();

  constructor(config: Partial<SelfHealingConfig> = {}, scanner?: Scanner) {
    this.config = { ...DEFAULT_SELF_HEALING_CONFIG, ...config };
    this.scanner = scanner;
  }

  /**
   * Check if a task should be retried based on attempt count
   */
  shouldRetry(taskId: string, error: Error): boolean {
    const attempts = this.getAttempts(taskId);
    const retryableErrors = ['timed out', 'unavailable', 'network', 'timeout'];

    const isRetryable = retryableErrors.some((keyword) =>
      error.message.toLowerCase().includes(keyword)
    );

    if (!isRetryable) {
      return false;
    }

    return attempts.length < this.config.maxRetries;
  }

  /**
   * Check if agent replacement should be attempted
   */
  shouldReplaceAgent(taskId: string): boolean {
    if (!this.config.enableAgentReplacement) {
      return false;
    }

    const attempts = this.getAttempts(taskId);
    const retriesExhausted = attempts.length >= this.config.maxRetries;

    return retriesExhausted && attempts.some((a) => a.strategy === 'retry');
  }

  /**
   * Record a healing attempt
   */
  recordAttempt(attempt: HealingAttempt): void {
    const attempts = this.healingAttempts.get(attempt.taskId) || [];
    attempts.push(attempt);
    this.healingAttempts.set(attempt.taskId, attempts);
  }

  /**
   * Get all healing attempts for a task
   */
  getAttempts(taskId: string): HealingAttempt[] {
    return this.healingAttempts.get(taskId) || [];
  }

  /**
   * Get the most recent healing attempt for a task
   */
  getLatestAttempt(taskId: string): HealingAttempt | null {
    const attempts = this.getAttempts(taskId);
    return attempts.length > 0 ? attempts[attempts.length - 1] : null;
  }

  /**
   * Clear healing attempts for a task
   */
  clearAttempts(taskId: string): void {
    this.healingAttempts.delete(taskId);
  }

  /**
   * Select a replacement agent with the same role as the failed agent
   */
  selectReplacementAgent(
    failedAgentId: string,
    taskId: string,
    stepId: string
  ): string | null {
    if (!this.scanner) {
      return null;
    }

    const allAgents = this.scanner.getAllAgents();
    const failedAgent = allAgents.find((a) => a.id === failedAgentId);

    if (!failedAgent) {
      return null;
    }

    const attempts = this.getAttempts(taskId);
    const usedAgentIds = new Set(
      attempts.map((a) => a.originalAgentId).concat(attempts.map((a) => a.replacementAgentId || []).flat())
    );

    // Find agents with the same department and similar capabilities
    const candidates = allAgents.filter((agent) => {
      if (agent.id === failedAgentId) {
        return false;
      }
      if (usedAgentIds.has(agent.id)) {
        return false;
      }
      // Same department is a good proxy for similar role
      return agent.department === failedAgent.department;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Return the first available candidate
    return candidates[0].id;
  }

  /**
   * Create a checkpoint for workflow recovery
   */
  createCheckpoint(workflowPlanId: string, taskId: string, context: {
    completedSteps: string[];
    currentStep?: string;
  }): WorkflowCheckpoint {
    return {
      workflowPlanId,
      taskId,
      completedSteps: context.completedSteps,
      currentStep: context.currentStep,
      timestamp: new Date().toISOString(),
      context: {
        completedSteps: context.completedSteps,
        currentStep: context.currentStep,
      },
    };
  }

  /**
   * Delay before retry
   */
  async delayBeforeRetry(attemptNumber: number): Promise<void> {
    const delay = this.config.retryDelayMs * attemptNumber;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Get the current configuration
   */
  getConfig(): SelfHealingConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration
   */
  updateConfig(updates: Partial<SelfHealingConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Generate a summary of healing attempts for a task
   */
  generateHealingSummary(taskId: string): string {
    const attempts = this.getAttempts(taskId);

    if (attempts.length === 0) {
      return 'No healing attempts recorded.';
    }

    const successful = attempts.filter((a) => a.success).length;
    const strategies = attempts.map((a) => a.strategy);
    const strategyCounts = strategies.reduce((acc, strategy) => {
      acc[strategy] = (acc[strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parts = [
      `Total attempts: ${attempts.length}`,
      `Successful: ${successful}`,
      `Strategies used: ${Object.entries(strategyCounts)
        .map(([strategy, count]) => `${strategy} (${count})`)
        .join(', ')}`,
    ];

    if (attempts.some((a) => a.replacementAgentId)) {
      const replacements = attempts.filter((a) => a.replacementAgentId).length;
      parts.push(`Agent replacements: ${replacements}`);
    }

    return parts.join('\n');
  }
}

/**
 * Factory function to create a SelfHealingService
 */
export function createSelfHealingService(
  config?: Partial<SelfHealingConfig>,
  scanner?: Scanner
): SelfHealingService {
  return new SelfHealingService(config, scanner);
}
