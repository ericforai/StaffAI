/**
 * Approval Chains API Routes
 *
 * Provides HTTP endpoints for multi-step approval chain workflow.
 * All routes follow the pattern /api/approval-chains/*
 */

import type express from 'express';
import {
  createChain,
  getChain,
  advanceChain,
  isChainComplete,
} from '../governance/approval-chain-service';
import type { ApprovalChain } from '../shared/approval-chain-types';

/**
 * Register approval chain routes
 */
export function registerApprovalChainRoutes(app: express.Application) {
  /**
   * GET /api/approval-chains/:taskId
   *
   * Get the approval chain for a task.
   *
   * Path params:
   * - taskId: string - Task identifier
   *
   * Returns:
   * - chain: ApprovalChain - The approval chain or null if not found
   * - exists: boolean - Whether a chain exists for this task
   */
  app.get('/api/approval-chains/:taskId', (req, res) => {
    const taskId = req.params.taskId;

    try {
      const chain = getChain(taskId);

      if (!chain) {
        return res.json({
          chain: null,
          exists: false,
          taskId,
        });
      }

      return res.json({
        chain,
        exists: true,
        taskId,
      });
    } catch (error) {
      console.error('[Approval Chain API] Failed to get chain:', error);
      return res.status(500).json({
        error: 'Failed to retrieve approval chain',
      });
    }
  });

  /**
   * POST /api/approval-chains/:taskId/advance
   *
   * Advance an approval chain by processing the current step.
   *
   * Path params:
   * - taskId: string - Task identifier
   *
   * Body:
   * - approverRole: string - Role of the approver (must match current step role)
   * - decision: 'approve' | 'reject' - Approval decision
   * - comment?: string - Optional comment from approver
   *
   * Returns:
   * - chain: ApprovalChain - Updated approval chain
   * - isComplete: boolean - Whether the chain is complete
   */
  app.post('/api/approval-chains/:taskId/advance', (req, res) => {
    const taskId = req.params.taskId;
    const { approverRole, decision, comment } = req.body;

    // Validate approverRole
    if (typeof approverRole !== 'string' || !approverRole.trim()) {
      return res.status(400).json({
        error: 'approverRole is required and must be a non-empty string',
      });
    }

    // Validate decision
    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({
        error: 'decision must be either "approve" or "reject"',
      });
    }

    // Validate optional comment
    if (comment !== undefined && typeof comment !== 'string') {
      return res.status(400).json({
        error: 'comment must be a string if provided',
      });
    }

    try {
      const updatedChain = advanceChain(
        taskId,
        approverRole,
        decision,
        comment
      );

      return res.json({
        chain: updatedChain,
        isComplete: updatedChain.status === 'completed',
        taskId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Determine appropriate status code based on error type
      if (errorMessage.includes('not found')) {
        return res.status(404).json({
          error: errorMessage,
          taskId,
        });
      }

      if (errorMessage.includes('Role mismatch') || errorMessage.includes('Cannot advance chain')) {
        return res.status(400).json({
          error: errorMessage,
          taskId,
        });
      }

      console.error('[Approval Chain API] Failed to advance chain:', error);
      return res.status(500).json({
        error: 'Failed to advance approval chain',
      });
    }
  });
}
