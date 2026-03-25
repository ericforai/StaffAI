import type { WorkflowPlan, TaskAssignment } from '../shared/task-types';
import type { Store } from '../store';
import type { AssignmentExecutor } from './assignment-executor';
import type { RunningWorkflow } from './workflow-execution-engine';
import { updateAssignmentExecutionStatus } from './assignment-status-updater';

/**
 * Cancel a running workflow
 * Cancels all assignments and updates workflow status
 */
export async function cancelWorkflow(
  workflowPlanId: string,
  store: Pick<
    Store,
    | 'getWorkflowPlanByTaskId'
    | 'getTaskAssignmentsByTaskId'
    | 'updateWorkflowPlan'
    | 'updateTaskAssignment'
    | 'updateTask'
    | 'getWorkflowPlans'
  >,
  assignmentExecutor: AssignmentExecutor,
  runningWorkflows: Map<string, RunningWorkflow>,
  logAuditEvent?: (event: {
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
  }) => Promise<void>
): Promise<void> {
  const running = runningWorkflows.get(workflowPlanId);
  if (!running || running.status !== 'running') {
    return;
  }

  runningWorkflows.set(workflowPlanId, {
    ...running,
    status: 'skipped',
  });

  const workflow = await findWorkflowPlan(workflowPlanId, store);
  if (!workflow) {
    return;
  }

  const assignments = await store.getTaskAssignmentsByTaskId(workflow.taskId);

  for (const assignment of assignments) {
    await assignmentExecutor.cancel(assignment.id);
    await updateAssignmentExecutionStatus(store, assignment.id, 'skipped');
  }

  await store.updateWorkflowPlan(workflow.taskId, (current) => ({
    ...current,
    status: 'running',
    updatedAt: new Date().toISOString(),
  }));

  await store.updateTask(workflow.taskId, (current) => ({
    ...current,
    status: 'failed',
    updatedAt: new Date().toISOString(),
  }));

  if (logAuditEvent) {
    await logAuditEvent({
      entityType: 'execution',
      entityId: workflowPlanId,
      action: 'cancelled',
      actor: 'system',
      previousState: { status: 'running' },
      newState: { status: 'skipped' },
    });
  }
}

/**
 * Find a workflow plan by its ID
 */
export async function findWorkflowPlan(
  workflowPlanId: string,
  store: Pick<Store, 'getWorkflowPlanByTaskId' | 'getWorkflowPlans'>
): Promise<WorkflowPlan | null> {
  const allPlans = await store.getWorkflowPlans();
  return allPlans.find((p: WorkflowPlan) => p.id === workflowPlanId) ?? null;
}
