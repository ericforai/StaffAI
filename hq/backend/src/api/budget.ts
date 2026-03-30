/**
 * Budget API Routes
 *
 * Provides HTTP endpoints for budget tracking and enforcement.
 * All routes follow the pattern /api/budget/*
 */

import type express from 'express';
import { BudgetService } from '../governance/budget-service';
import type { BudgetConfig } from '../shared/budget-types';

/**
 * Budget route dependencies
 */
export interface BudgetRouteDependencies {
  budgetService: BudgetService;
}

/**
 * Register budget routes
 */
export function registerBudgetRoutes(
  app: express.Application,
  dependencies: BudgetRouteDependencies
) {
  const { budgetService } = dependencies;

  /**
   * GET /api/budget/usage/:taskId
   *
   * Get current budget usage for a task.
   *
   * Path params:
   * - taskId: string - Task identifier
   *
   * Returns:
   * - usage: BudgetUsage - Current usage statistics
   */
  app.get('/api/budget/usage/:taskId', async (req, res) => {
    const taskId = req.params.taskId;

    try {
      const usage = budgetService.getUsage(taskId);

      if (!usage) {
        return res.status(404).json({
          error: 'No usage found for task',
          taskId,
        });
      }

      return res.json({ usage });
    } catch (error) {
      console.error('[Budget API] Failed to get usage:', error);
      return res.status(500).json({
        error: 'Failed to retrieve budget usage',
      });
    }
  });

  /**
   * POST /api/budget/check/:taskId
   *
   * Check if a task is within budget limits before execution.
   *
   * Path params:
   * - taskId: string - Task identifier
   *
   * Body:
   * - config?: BudgetConfig - Budget configuration to enforce
   *
   * Returns:
   * - withinBudget: boolean - Whether task can proceed
   * - usage: BudgetUsage - Current usage statistics
   * - reason?: string - Reason if not within budget
   */
  app.post('/api/budget/check/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    const config: BudgetConfig = req.body.config ?? {};

    try {
      const status = await budgetService.checkBudget(taskId, config);

      if (!status.withinBudget) {
        return res.status(403).json(status);
      }

      return res.json(status);
    } catch (error) {
      console.error('[Budget API] Failed to check budget:', error);
      return res.status(500).json({
        error: 'Failed to check budget',
      });
    }
  });

  /**
   * POST /api/budget/record
   *
   * Record token usage for a task after execution.
   *
   * Body:
   * - taskId: string - Task identifier
   * - tokensUsed: number - Number of tokens consumed
   * - costUsd: number - Estimated cost in USD
   *
   * Returns:
   * - success: boolean - Recording succeeded
   */
  app.post('/api/budget/record', async (req, res) => {
    const { taskId, tokensUsed, costUsd } = req.body;

    // Validate required fields
    if (typeof taskId !== 'string' || !taskId.trim()) {
      return res.status(400).json({
        error: 'taskId is required and must be a non-empty string',
      });
    }

    if (typeof tokensUsed !== 'number' || tokensUsed < 0) {
      return res.status(400).json({
        error: 'tokensUsed is required and must be a non-negative number',
      });
    }

    if (typeof costUsd !== 'number' || costUsd < 0) {
      return res.status(400).json({
        error: 'costUsd is required and must be a non-negative number',
      });
    }

    try {
      await budgetService.recordUsage(taskId, tokensUsed, costUsd);

      return res.json({
        success: true,
        taskId,
        tokensUsed,
        costUsd,
      });
    } catch (error) {
      console.error('[Budget API] Failed to record usage:', error);
      return res.status(500).json({
        error: 'Failed to record budget usage',
      });
    }
  });
}
