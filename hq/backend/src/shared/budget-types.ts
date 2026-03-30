/**
 * Budget circuit breaker types for cost tracking and automatic shutoff.
 */

/**
 * Budget configuration for a task execution.
 */
export interface BudgetConfig {
  /**
   * Maximum number of tokens allowed for this task.
   * Set to 0 or undefined for no token limit.
   */
  maxTokens?: number;

  /**
   * Maximum cost in USD allowed for this task.
   * Set to 0 or undefined for no cost limit.
   */
  maxCostUsd?: number;

  /**
   * Warning threshold as a percentage (0-1).
   * Emits a budget_warning event when usage crosses this threshold.
   * Default: 0.8 (80%)
   */
  warningThresholdPct?: number;
}

/**
 * Budget usage tracking for a task.
 */
export interface BudgetUsage {
  /**
   * Task ID this usage is tracking.
   */
  taskId: string;

  /**
   * Total tokens used so far.
   */
  tokensUsed: number;

  /**
   * Estimated cost in USD so far.
   */
  estimatedCostUsd: number;

  /**
   * Budget limit being enforced.
   */
  budgetLimit: BudgetConfig;

  /**
   * Whether a warning has been emitted for crossing the threshold.
   */
  warningEmitted: boolean;
}

/**
 * Budget status check result.
 */
export interface BudgetStatus {
  /**
   * Whether the task is still within budget limits.
   */
  withinBudget: boolean;

  /**
   * Current usage statistics.
   */
  usage: BudgetUsage;

  /**
   * If not within budget, the reason why.
   */
  reason?: 'tokens_exceeded' | 'cost_exceeded';
}
