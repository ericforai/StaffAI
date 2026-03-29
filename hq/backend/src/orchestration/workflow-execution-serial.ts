import type { WorkflowPlan, TaskAssignment, TaskRecord, TaskAssignmentStatus } from '../shared/task-types';
import type { AssignmentExecutor } from './assignment-executor';
import type { RunningWorkflow, WorkflowExecutionResult } from './workflow-execution-engine';
import { getDefaultTaskTimeoutMs } from '../runtime/task-execution-config';
import type { SelfHealingService } from '../runtime/self-healing-service';

/**
 * Execute a workflow plan in serial mode with self-healing
 * Steps are executed one after another with retry and agent replacement on failure
 */
export async function executeSerialWorkflow(
  workflowPlan: WorkflowPlan,
  assignments: TaskAssignment[],
  task: TaskRecord,
  assignmentExecutor: AssignmentExecutor,
  runningWorkflows: Map<string, RunningWorkflow>,
  selfHealingService?: SelfHealingService
): Promise<WorkflowExecutionResult> {
  const timeoutMs = getDefaultTaskTimeoutMs();
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

    const runningPrev = runningWorkflows.get(workflowPlan.id);
    const mergedCompleted = new Set(runningPrev?.completedSteps ?? []);
    updateWorkflowTracking(workflowPlan.id, step.id, mergedCompleted, runningWorkflows);

    // Save checkpoint before executing step
    if (selfHealingService) {
      const checkpoint = selfHealingService.createCheckpoint(
        workflowPlan.id,
        task.id,
        {
          completedSteps,
          currentStep: step.id,
        }
      );
      // Store checkpoint data in running workflow for recovery
      const running = runningWorkflows.get(workflowPlan.id);
      if (running) {
        runningWorkflows.set(workflowPlan.id, {
          ...running,
          currentStep: step.id,
          completedSteps: mergedCompleted,
        });
      }
    }

    // Execute step with self-healing
    const result = await executeStepWithHealing(
      assignment,
      step,
      task,
      assignmentExecutor,
      timeoutMs,
      workflowPlan.id,
      selfHealingService
    );

    if (result.status === 'failed') {
      await updateStepState(workflowPlan.id, step.id, 'failed', assignment);
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
    mergedCompleted.add(step.id);
    await updateStepState(workflowPlan.id, step.id, 'completed', assignment);
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
 * Execute a single workflow step with self-healing support
 */
async function executeStepWithHealing(
  assignment: TaskAssignment,
  step: WorkflowPlan['steps'][0],
  task: TaskRecord,
  assignmentExecutor: AssignmentExecutor,
  timeoutMs: number,
  workflowPlanId: string,
  selfHealingService?: SelfHealingService
): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  let currentAssignment = assignment;
  let attemptNumber = 0;
  const maxAttempts = selfHealingService ? selfHealingService.getConfig().maxRetries + 1 : 1;

  while (attemptNumber < maxAttempts) {
    attemptNumber++;

    const result = await assignmentExecutor.execute(currentAssignment, {
      taskId: task.id,
      title: task.title,
      description: step.description ?? step.title,
      executor: 'claude',
      timeoutMs,
    });

    if (result.status === 'completed') {
      // Record successful healing attempt
      if (selfHealingService && attemptNumber > 1) {
        selfHealingService.recordAttempt({
          attemptNumber,
          taskId: task.id,
          stepId: step.id,
          assignmentId: currentAssignment.id,
          error: new Error('Step completed successfully after retry'),
          timestamp: new Date().toISOString(),
          strategy: currentAssignment.agentId !== assignment.agentId ? 'replace_agent' : 'retry',
          originalAgentId: assignment.agentId,
          replacementAgentId: currentAssignment.agentId !== assignment.agentId ? currentAssignment.agentId : undefined,
          success: true,
          outputSummary: result.outputSummary,
          outputSnapshot: result.outputSnapshot,
        });
      }
      return { status: 'completed' };
    }

    // Record failed attempt
    const error = new Error(result.error ?? 'Assignment execution failed');
    if (selfHealingService) {
      selfHealingService.recordAttempt({
        attemptNumber,
        taskId: task.id,
        stepId: step.id,
        assignmentId: currentAssignment.id,
        error,
        timestamp: new Date().toISOString(),
        strategy: 'retry',
        originalAgentId: currentAssignment.agentId,
        success: false,
      });

      // Check if we should retry
      if (selfHealingService.shouldRetry(task.id, error)) {
        await selfHealingService.delayBeforeRetry(attemptNumber);
        continue;
      }

      // Check if we should replace agent
      if (selfHealingService.shouldReplaceAgent(task.id)) {
        const replacementAgentId = selfHealingService.selectReplacementAgent(
          currentAssignment.agentId,
          task.id,
          step.id
        );

        if (replacementAgentId) {
          // Update assignment with replacement agent
          currentAssignment = {
            ...currentAssignment,
            agentId: replacementAgentId,
          };
          continue;
        }
      }

      // All strategies exhausted
      return {
        status: 'failed',
        error: `Step failed after ${attemptNumber} attempts. Last error: ${result.error}`,
      };
    }

    // No self-healing service, fail immediately
    return { status: 'failed', error: result.error };
  }

  return { status: 'failed', error: 'Max attempts exceeded' };
}

/**
 * Execute a workflow plan in phased parallel mode (Map-Reduce)
 * Steps with the same order execute concurrently.
 * Groups execute sequentially in ascending order.
 */
export async function executeParallelWorkflow(
  workflowPlan: WorkflowPlan,
  assignments: TaskAssignment[],
  task: TaskRecord,
  assignmentExecutor: AssignmentExecutor,
  runningWorkflows: Map<string, RunningWorkflow>
): Promise<WorkflowExecutionResult> {
  const timeoutMs = getDefaultTaskTimeoutMs();
  const completedSteps: string[] = [];
  const updatedAssignments: TaskAssignment[] = [...assignments];

  // Group steps by order
  const stepsByOrder = new Map<number, typeof workflowPlan.steps>();
  for (const step of workflowPlan.steps) {
    const order = step.order || 1;
    const existing = stepsByOrder.get(order) || [];
    existing.push(step);
    stepsByOrder.set(order, existing);
  }

  // Sort orders numerically
  const sortedOrders = Array.from(stepsByOrder.keys()).sort((a, b) => a - b);

  try {
    for (const order of sortedOrders) {
      const group = stepsByOrder.get(order)!;
      
      const results = await Promise.all(
        group.map(async (step) => {
          const assignment = assignments.find((a) => a.id === step.assignmentId);
          if (!assignment) {
            throw new Error(`Assignment not found for step ${step.id}`);
          }

          const running = runningWorkflows.get(workflowPlan.id);
          if (running) {
             // currentStep in parallel might be one of the group
             running.currentStep = step.id;
          }

          const result = await assignmentExecutor.execute(assignment, {
            taskId: task.id,
            title: task.title,
            description: step.description ?? step.title,
            executor: 'claude',
            timeoutMs,
          });

          if (result.status === 'completed') {
            completedSteps.push(step.id);
            await updateStepState(workflowPlan.id, step.id, 'completed', assignment);
            if (running) {
              running.completedSteps.add(step.id);
            }
          } else {
            await updateStepState(workflowPlan.id, step.id, 'failed', assignment);
            throw new Error(`Step ${step.id} failed: ${result.error}`);
          }
          return result;
        })
      );
    }

    return {
      workflowPlanId: workflowPlan.id,
      status: 'completed',
      completedSteps,
      assignments: updatedAssignments,
      outputSummary: `Successfully executed ${completedSteps.length} parallel steps in ${sortedOrders.length} phases`,
    };
  } catch (error) {
    return {
      workflowPlanId: workflowPlan.id,
      status: 'failed',
      completedSteps,
      failedStep: workflowPlan.steps.find((s) => !completedSteps.includes(s.id))?.id,
      error: error instanceof Error ? error.message : String(error),
      assignments: updatedAssignments,
    };
  }
}

/**
 * Update step state helper
 */
async function updateStepState(
  workflowPlanId: string,
  stepId: string,
  status: TaskAssignmentStatus,
  assignment: TaskAssignment
): Promise<void> {
  // In a real implementation, this would update the store
  assignment.status = status;
  assignment.updatedAt = new Date().toISOString();
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
  const prev = runningWorkflows.get(workflowPlanId);
  runningWorkflows.set(workflowPlanId, {
    workflowPlanId,
    status: 'running',
    startedAt: prev?.startedAt ?? new Date().toISOString(),
    completedSteps,
    currentStep,
  });
}
