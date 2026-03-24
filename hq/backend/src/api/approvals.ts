import type express from 'express';
import type { Store } from '../store';
import { approveApproval, rejectApproval } from '../governance/approval-service';
import type { ApprovalRecord } from '../shared/task-types';

interface ApprovalRouteDependencies {
  onApprovalResolved?: (approval: ApprovalRecord) => void;
}

export function registerApprovalRoutes(
  app: express.Application,
  store: Store,
  dependencies: ApprovalRouteDependencies = {}
) {
  app.get('/api/approvals', async (_req, res) => {
    const approvals = await store.getApprovals();
    return res.json({
      approvals,
      stage: 'sprint-1-skeleton',
    });
  });

  app.post('/api/approvals/:id/approve', async (req, res) => {
    const approval = await approveApproval(req.params.id, store);
    if (!approval) {
      return res.status(404).json({
        error: 'approval not found',
        approvalId: req.params.id,
        stage: 'sprint-1-skeleton',
      });
    }

    const task = await store.updateTask(approval.taskId, (currentTask) => ({
      ...currentTask,
      status: 'created',
      approvalRequired: false,
      updatedAt: new Date().toISOString(),
    }));
    dependencies.onApprovalResolved?.(approval);

    return res.json({
      approval,
      task,
      stage: 'sprint-1-skeleton',
    });
  });

  app.post('/api/approvals/:id/reject', async (req, res) => {
    const approval = await rejectApproval(req.params.id, store);
    if (!approval) {
      return res.status(404).json({
        error: 'approval not found',
        approvalId: req.params.id,
        stage: 'sprint-1-skeleton',
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
      stage: 'sprint-1-skeleton',
    });
  });
}
