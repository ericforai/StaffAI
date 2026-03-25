import type express from 'express';
import type { Store } from '../store';
import {
  ApprovalServiceV2,
  createApprovalServiceV2,
  approveApproval,
  rejectApproval,
} from '../governance/approval-service-v2';
import type { ApprovalRecord, ApprovalStatus } from '../shared/task-types';

interface ApprovalRouteDependencies {
  onApprovalResolved?: (approval: ApprovalRecord) => void;
  approvalService?: ApprovalServiceV2;
}

interface ExtendedApprovalSummary {
  total: number;
  statusCounts: Record<ApprovalStatus, number>;
  latestRequestedAt: string | null;
  latestResolvedAt: string | null;
  riskLevelSummary?: {
    high: number;
    medium: number;
    low: number;
  };
}

function buildApprovalSummary(approvals: ApprovalRecord[]): ExtendedApprovalSummary {
  const statusCounts: Record<ApprovalStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };
  let latestRequestedAt: string | null = null;
  let latestResolvedAt: string | null = null;
  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;

  for (const approval of approvals) {
    statusCounts[approval.status] += 1;

    if (!latestRequestedAt || Date.parse(approval.requestedAt) > Date.parse(latestRequestedAt)) {
      latestRequestedAt = approval.requestedAt;
    }

    if (approval.resolvedAt && (!latestResolvedAt || Date.parse(approval.resolvedAt) > Date.parse(latestResolvedAt))) {
      latestResolvedAt = approval.resolvedAt;
    }

    // Count risk levels from extended fields if present
    if ('riskLevel' in approval) {
      const extendedApproval = approval as ApprovalRecord & { riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' };
      switch (extendedApproval.riskLevel) {
        case 'HIGH':
          highRisk++;
          break;
        case 'MEDIUM':
          mediumRisk++;
          break;
        case 'LOW':
          lowRisk++;
          break;
      }
    }
  }

  return {
    total: approvals.length,
    statusCounts,
    latestRequestedAt,
    latestResolvedAt,
    riskLevelSummary: {
      high: highRisk,
      medium: mediumRisk,
      low: lowRisk,
    },
  };
}

export function registerApprovalRoutes(
  app: express.Application,
  store: Store,
  dependencies: ApprovalRouteDependencies = {}
) {
  // Use ApprovalServiceV2 if provided, otherwise use legacy functions
  const approvalService = dependencies.approvalService ?? null;

  app.get('/api/approvals', async (_req, res) => {
    const approvals = await store.getApprovals();
    const orderedApprovals = [...approvals].sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'pending') {
          return -1;
        }
        if (right.status === 'pending') {
          return 1;
        }
      }

      return Date.parse(right.requestedAt) - Date.parse(left.requestedAt);
    });

    // Enrich with extended fields if using ApprovalServiceV2
    let enrichedApprovals = orderedApprovals;
    if (approvalService) {
      enrichedApprovals = await Promise.all(
        orderedApprovals.map(async (approval) => {
          const extended = await approvalService.getExtendedApproval(approval.id);
          return extended || approval;
        })
      );
    }

    return res.json({
      approvals: enrichedApprovals,
      summary: buildApprovalSummary(enrichedApprovals),
    });
  });

  app.get('/api/approvals/:id', async (req, res) => {
    const approvals = await store.getApprovals();
    const approval = approvals.find((a) => a.id === req.params.id);

    if (!approval) {
      return res.status(404).json({
        error: 'approval not found',
        approvalId: req.params.id,
      });
    }

    // Return extended approval if using ApprovalServiceV2
    if (approvalService) {
      const extended = await approvalService.getExtendedApproval(req.params.id);
      return res.json({ approval: extended || approval });
    }

    return res.json({ approval });
  });

  app.post('/api/approvals/:id/approve', async (req, res) => {
    const approver = (req.body?.approver as string) || 'system';
    const reason = req.body?.reason as string | undefined;

    let approval: ApprovalRecord | null = null;

    // Use ApprovalServiceV2 if available
    if (approvalService) {
      const result = await approvalService.approve({
        approvalId: req.params.id,
        approver,
        decision: 'approved',
        reason,
      });
      approval = result;
    } else {
      // Fallback to legacy function
      approval = await approveApproval(req.params.id, store, approver);
    }

    if (!approval) {
      return res.status(404).json({
        error: 'approval not found',
        approvalId: req.params.id,
      });
    }

    const task = await store.updateTask(approval.taskId, (currentTask) => ({
      ...currentTask,
      status: 'routed',
      approvalRequired: false,
      updatedAt: new Date().toISOString(),
    }));
    dependencies.onApprovalResolved?.(approval);

    return res.json({
      approval,
      task,
      summary: buildApprovalSummary(await store.getApprovals()),
    });
  });

  app.post('/api/approvals/:id/reject', async (req, res) => {
    const approver = (req.body?.approver as string) || 'system';
    const reason = req.body?.reason as string | undefined;

    let approval: ApprovalRecord | null = null;

    // Use ApprovalServiceV2 if available
    if (approvalService) {
      const result = await approvalService.reject({
        approvalId: req.params.id,
        approver,
        decision: 'rejected',
        reason,
      });
      approval = result;
    } else {
      // Fallback to legacy function
      approval = await rejectApproval(req.params.id, store, approver);
    }

    if (!approval) {
      return res.status(404).json({
        error: 'approval not found',
        approvalId: req.params.id,
      });
    }

    const task = await store.updateTask(approval.taskId, (currentTask) => ({
      ...currentTask,
      status: 'cancelled',
      approvalRequired: true,
      updatedAt: new Date().toISOString(),
    }));
    dependencies.onApprovalResolved?.(approval);

    return res.json({
      approval,
      task,
      summary: buildApprovalSummary(await store.getApprovals()),
    });
  });

  // New endpoint: Cancel approval (only with ApprovalServiceV2)
  app.post('/api/approvals/:id/cancel', async (req, res) => {
    if (!approvalService) {
      return res.status(501).json({
        error: 'cancel approval not available - requires ApprovalServiceV2',
      });
    }

    const actor = (req.body?.actor as string) || 'system';
    const reason = req.body?.reason as string | undefined;

    try {
      const approval = await approvalService.cancel({
        approvalId: req.params.id,
        actor,
        reason,
      });

      if (!approval) {
        return res.status(404).json({
          error: 'approval not found',
          approvalId: req.params.id,
        });
      }

      // Update associated task
      await store.updateTask(approval.taskId, (currentTask) => ({
        ...currentTask,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      }));

      return res.json({
        approval,
        summary: buildApprovalSummary(await store.getApprovals()),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'ApprovalNotFoundError' || error.constructor.name === 'ApprovalNotFoundError')
      ) {
        return res.status(404).json({
          error: 'approval not found',
          approvalId: req.params.id,
        });
      }
      if (
        error instanceof Error &&
        (error.name === 'InvalidApprovalStateError' || error.constructor.name === 'InvalidApprovalStateError')
      ) {
        return res.status(400).json({
          error: 'cannot cancel approval',
          reason: 'approval is not in pending state',
        });
      }
      throw error;
    }
  });

  // New endpoint: Get extended approval details
  app.get('/api/approvals/:id/extended', async (req, res) => {
    if (!approvalService) {
      return res.status(501).json({
        error: 'extended approval details not available - requires ApprovalServiceV2',
      });
    }

    const approval = await approvalService.getExtendedApproval(req.params.id);

    if (!approval) {
      return res.status(404).json({
        error: 'approval not found',
        approvalId: req.params.id,
      });
    }

    return res.json({ approval });
  });
}
