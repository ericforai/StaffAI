/**
 * Budget circuit breaker service for cost tracking and automatic shutoff.
 */

import type {
  BudgetConfig,
  BudgetStatus,
  BudgetUsage,
} from '../shared/budget-types';

export interface BudgetWarningEvent {
  taskId: string;
  usage: BudgetUsage;
  thresholdPct: number;
  currentPct: number;
}

export interface BudgetServiceOptions {
  /**
   * Callback for budget warning events.
   * Called when usage crosses warningThresholdPct.
   */
  onBudgetWarning?: (event: BudgetWarningEvent) => void | Promise<void>;
}

/**
 * Budget service for tracking task execution costs and enforcing limits.
 *
 * Uses in-memory storage for v1 (no persistence).
 */
export class BudgetService {
  private readonly usageByTask = new Map<string, BudgetUsage>();
  private readonly options: BudgetServiceOptions;

  constructor(options: BudgetServiceOptions = {}) {
    this.options = options;
  }

  /**
   * Check if a task is within budget limits.
   *
   * @param taskId - Task ID to check
   * @param config - Budget configuration to enforce
   * @returns Budget status with usage details
   */
  async checkBudget(taskId: string, config: BudgetConfig = {}): Promise<BudgetStatus> {
    const usage = this.getUsage(taskId) ?? this.createInitialUsage(taskId, config);

    // Check token limit
    if (config.maxTokens !== undefined && config.maxTokens > 0) {
      if (usage.tokensUsed >= config.maxTokens) {
        return {
          withinBudget: false,
          usage,
          reason: 'tokens_exceeded',
        };
      }
    }

    // Check cost limit
    if (config.maxCostUsd !== undefined && config.maxCostUsd > 0) {
      if (usage.estimatedCostUsd >= config.maxCostUsd) {
        return {
          withinBudget: false,
          usage,
          reason: 'cost_exceeded',
        };
      }

      // Check warning threshold
      const thresholdPct = config.warningThresholdPct ?? 0.8;
      if (!usage.warningEmitted && usage.estimatedCostUsd >= config.maxCostUsd * thresholdPct) {
        usage.warningEmitted = true;
        this.usageByTask.set(taskId, usage);

        // Emit warning event
        const currentPct = usage.estimatedCostUsd / config.maxCostUsd;
        await this.options.onBudgetWarning?.({
          taskId,
          usage,
          thresholdPct,
          currentPct,
        });
      }
    }

    return {
      withinBudget: true,
      usage,
    };
  }

  /**
   * Record usage for a task.
   *
   * @param taskId - Task ID to record usage for
   * @param tokensUsed - Number of tokens used
   * @param costUsd - Estimated cost in USD
   */
  async recordUsage(taskId: string, tokensUsed: number, costUsd: number): Promise<void> {
    const existing = this.usageByTask.get(taskId);
    if (existing) {
      const updated: BudgetUsage = {
        ...existing,
        tokensUsed: existing.tokensUsed + tokensUsed,
        estimatedCostUsd: existing.estimatedCostUsd + costUsd,
      };
      this.usageByTask.set(taskId, updated);
    } else {
      this.usageByTask.set(taskId, {
        taskId,
        tokensUsed,
        estimatedCostUsd: costUsd,
        budgetLimit: {},
        warningEmitted: false,
      });
    }
  }

  /**
   * Get current usage for a task.
   *
   * @param taskId - Task ID to get usage for
   * @returns Usage record or undefined if no usage recorded
   */
  getUsage(taskId: string): BudgetUsage | undefined {
    return this.usageByTask.get(taskId);
  }

  /**
   * Clear usage tracking for a task.
   *
   * @param taskId - Task ID to clear
   */
  clearUsage(taskId: string): void {
    this.usageByTask.delete(taskId);
  }

  /**
   * Get all tracked tasks.
   *
   * @returns Map of all tracked usage
   */
  getAllUsage(): Map<string, BudgetUsage> {
    return new Map(this.usageByTask);
  }

  private createInitialUsage(taskId: string, config: BudgetConfig): BudgetUsage {
    return {
      taskId,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      budgetLimit: config,
      warningEmitted: false,
    };
  }
}
