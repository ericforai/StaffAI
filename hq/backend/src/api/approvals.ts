import type express from 'express';
import type { Store } from '../store';
import { approveApproval, rejectApproval } from '../governance/approval-service';
import type { ApprovalRecord, ApprovalStatus } from '../shared/task-types';

interface ApprovalRouteDependencies {
  onApprovalResolved?: (approval: ApprovalRecord) => void;
}

function buildApprovalSummary(approvals: ApprovalRecord[]) {
  const statusCounts: Record<ApprovalStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  let latestRequestedAt: string | null = null;
  let latestResolvedAt: string | null = null;

  for (const approval of approvals) {
    statusCounts[approval.status] += 1;

    if (!latestRequestedAt || Date.parse(approval.requestedAt) > Date.parse(latestRequestedAt)) {
      latestRequestedAt = approval.requestedAt;
    }

    if (approval.resolvedAt && (!latestResolvedAt || Date.parse(approval.resolvedAt) > Date.parse(latestResolvedAt))) {
      latestResolvedAt = approval.resolvedAt;
    }
  }

  return {
    total: approvals.length,
    statusCounts,
    latestRequestedAt,
    latestResolvedAt,
  };
}

export function registerApprovalRoutes(
  app: express.Application,
  store: Store,
  dependencies: ApprovalRouteDependencies = {}
) {
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

    return res.json({
      approvals: orderedApprovals,
      summary: buildApprovalSummary(orderedApprovals),
    });
  });

  app.post('/api/approvals/:id/approve', async (req, res) => {
    const approval = await approveApproval(req.params.id, store);
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
    const approval = await rejectApproval(req.params.id, store);
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
}
