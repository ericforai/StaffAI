import type { WorkflowPlan, TaskAssignment, TaskRecord, TaskAssignmentStatus } from '../shared/task-types';
import type { AssignmentExecutor } from './assignment-executor';
import type { RunningWorkflow, WorkflowExecutionResult } from './workflow-execution-engine';

/**
 * Execute a workflow plan in serial mode
 * Steps are executed one after another, stopping on first failure
 */
export async function executeSerialWorkflow(
  workflowPlan: WorkflowPlan,
  assignments: TaskAssignment[],
  task: TaskRecord,
  assignmentExecutor: AssignmentExecutor,
  runningWorkflows: Map<string, RunningWorkflow>
): Promise<WorkflowExecutionResult> {
  const completedSteps: string[] = [];
  const updatedAssignments: TaskAssignment[] = [...assignments];

  for (const step of workflowPlan.steps) {
    const assignment = assignments.find((a) => a.id === step.assignmentId);
    if (!assignment) {
      return {
        workflowPlanId: workflowPlan.id,
        status: 'failed',
        completedSteps,
        assignments: updatedAssignments,
        error: `Assignment not found for step: ${step.id}`,
        failedStep: step.id,
      };
    }

    updateWorkflowTracking(workflowPlan.id, step.id, new Set(), runningWorkflows);

    const result = await assignmentExecutor.execute(assignment, {
      taskId: task.id,
      title: task.title,
      description: step.description ?? step.title,
      executor: 'claude',
      timeoutMs: 30_000,
    });

    if (result.status === 'failed') {
      await updateStepStatus(workflowPlan.id, step.id, 'failed', assignment);
      return {
        workflowPlanId: workflowPlan.id,
        status: 'failed',
        completedSteps,
        assignments: updatedAssignments,
        error: result.error ?? 'Assignment execution failed',
        failedStep: step.id,
      };
    }

    completedSteps.push(step.id);
    await updateStepStatus(workflowPlan.id, step.id, 'completed', assignment);

    const running = runningWorkflows.get(workflowPlan.id);
    if (running) {
      running.completedSteps.add(step.id);
    }
  }

  return {
    workflowPlanId: workflowPlan.id,
    status: 'completed',
    completedSteps,
    assignments: updatedAssignments,
    outputSummary: 'Workflow completed successfully',
  };
}

/**
 * Execute a workflow plan in parallel mode
 * All steps are executed concurrently
 */
export async function executeParallelWorkflow(
  workflowPlan: WorkflowPlan,
  assignments: TaskAssignment[],
  task: TaskRecord,
  assignmentExecutor: AssignmentExecutor,
  runningWorkflows: Map<string, RunningWorkflow>
): Promise<WorkflowExecutionResult> {
  const completedSteps: string[] = [];
  const updatedAssignments: TaskAssignment[] = [...assignments];
  const promises = workflowPlan.steps.map(async (step) => {
    const assignment = assignments.find((a) => a.id === step.assignmentId);
    if (!assignment) {
      return {
        stepId: step.id,
        status: 'failed' as const,
        error: 'Assignment not found',
      };
    }

    const result = await assignmentExecutor.execute(assignment, {
      taskId: task.id,
      title: task.title,
      description: step.description ?? step.title,
      executor: 'claude',
      timeoutMs: 30_000,
    });

    return {
      stepId: step.id,
      status: result.status,
      error: result.error,
    };
  });

  const results = await Promise.all(promises);

  for (const result of results) {
    if (result.status === 'completed') {
      completedSteps.push(result.stepId);
      await updateStepStatus(workflowPlan.id, result.stepId, 'completed', assignments.find((a) => a.stepId === result.stepId)!);
    } else if (result.status === 'failed') {
      await updateStepStatus(workflowPlan.id, result.stepId, 'failed', assignments.find((a) => a.stepId === result.stepId)!);
    }
  }

  const hasFailures = results.some((r) => r.status === 'failed');
  const finalStatus = hasFailures ? 'failed' : 'completed';

  return {
    workflowPlanId: workflowPlan.id,
    status: finalStatus,
    completedSteps,
    assignments: updatedAssignments,
    outputSummary: finalStatus === 'completed' ? 'Parallel workflow completed successfully' : 'Some assignments failed',
  };
}

/**
 * Update workflow tracking for a running workflow
 */
export function updateWorkflowTracking(
  workflowPlanId: string,
  currentStep: string,
  completedSteps: Set<string>,
  runningWorkflows: Map<string, RunningWorkflow>
): void {
  const running = runningWorkflows.get(workflowPlanId);
  if (running) {
    runningWorkflows.set(workflowPlanId, {
      ...running,
      currentStep,
      completedSteps,
    });
  }
}

/**
 * Update step status via assignment status update
 */
async function updateStepStatus(
  workflowPlanId: string,
  stepId: string,
  status: TaskAssignmentStatus,
  assignment: TaskAssignment | undefined
): Promise<void> {
  if (!assignment) {
    return;
  }

  // The assignment status update would happen via the store
  // This is a placeholder for the actual update logic
  // In the real implementation, this would be handled by the assignment executor
}

// Re-export for use in other modules
export type { RunningWorkflow };
