import type { WorkflowPlan, TaskAssignment, TaskRecord } from '../shared/task-types';
import type { AuditLogger, AuditEvent } from '../governance/audit-logger';
import type { Store } from '../store';
import type { AssignmentExecutor } from './assignment-executor';
import { executeSerialWorkflow, executeParallelWorkflow, updateWorkflowTracking } from './workflow-execution-serial';
import { cancelWorkflow } from './workflow-execution-cancel';

/**
 * Status of workflow execution
 */
export interface WorkflowExecutionStatus {
  workflowPlanId: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'skipped';
  currentStep?: string;
  completedSteps: string[];
  pendingSteps: string[];
  startedAt?: string;
  endedAt?: string;
}

/**
 * Result of workflow execution
 */
export interface WorkflowExecutionResult {
  workflowPlanId: string;
  status: 'completed' | 'failed' | 'skipped';
  completedSteps: string[];
  failedStep?: string;
  error?: string;
  assignments: TaskAssignment[];
  outputSummary?: string;
}

/**
 * Engine for executing workflow plans
 * Handles both serial and parallel execution modes
 */
export interface WorkflowExecutionEngine {
  /**
   * Execute a workflow plan
   */
  execute(workflowPlan: WorkflowPlan): Promise<WorkflowExecutionResult>;

  /**
   * Resume a previously cancelled workflow
   */
  resume(workflowPlanId: string): Promise<void>;

  /**
   * Cancel a running workflow
   */
  cancel(workflowPlanId: string): Promise<void>;

  /**
   * Get current execution status
   */
  getStatus(workflowPlanId: string): WorkflowExecutionStatus;
}

/**
 * Internal tracking of running workflows
 */
export interface RunningWorkflow {
  workflowPlanId: string;
  status: 'running' | 'skipped';
  startedAt: string;
  completedSteps: Set<string>;
  currentStep?: string;
}

/**
 * Configuration for WorkflowExecutionEngine
 */
export interface WorkflowExecutionEngineConfig {
  store: Pick<
    Store,
    | 'getWorkflowPlanByTaskId'
    | 'getTaskAssignmentsByTaskId'
    | 'getTaskById'
    | 'updateWorkflowPlan'
    | 'updateTaskAssignment'
    | 'updateTask'
    | 'saveExecution'
    | 'getWorkflowPlans'
    | 'logAudit'
  >;
  assignmentExecutor: AssignmentExecutor;
  auditLogger: AuditLogger | null;
}

/**
 * Default implementation of WorkflowExecutionEngine
 */
export class DefaultWorkflowExecutionEngine implements WorkflowExecutionEngine {
  private readonly store: WorkflowExecutionEngineConfig['store'];
  private readonly assignmentExecutor: AssignmentExecutor;
  private readonly auditLogger: WorkflowExecutionEngineConfig['auditLogger'];
  private readonly runningWorkflows = new Map<string, RunningWorkflow>();

  constructor(config: WorkflowExecutionEngineConfig) {
    this.store = config.store;
    this.assignmentExecutor = config.assignmentExecutor;
    this.auditLogger = config.auditLogger;
  }

  async execute(workflowPlan: WorkflowPlan): Promise<WorkflowExecutionResult> {
    const workflow = await this.store.getWorkflowPlanByTaskId(workflowPlan.taskId);
    if (!workflow) {
      return {
        workflowPlanId: workflowPlan.id,
        status: 'failed',
        completedSteps: [],
        assignments: [],
        error: 'Workflow plan not found',
      };
    }

    const task = await this.store.getTaskById(workflowPlan.taskId);
    if (!task) {
      return {
        workflowPlanId: workflowPlan.id,
        status: 'failed',
        completedSteps: [],
        assignments: [],
        error: 'Task not found',
      };
    }

    const assignments = await this.store.getTaskAssignmentsByTaskId(workflowPlan.taskId);
    if (assignments.length === 0) {
      return {
        workflowPlanId: workflowPlan.id,
        status: 'failed',
        completedSteps: [],
        assignments: [],
        error: 'No assignments found for workflow',
      };
    }

    this.runningWorkflows.set(workflowPlan.id, {
      workflowPlanId: workflowPlan.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedSteps: new Set(),
    });

    await this.updateWorkflowStatus(workflowPlan.taskId, 'running');

    await this.logAuditEvent({
      entityType: 'execution',
      entityId: workflowPlan.id,
      action: 'started',
      actor: 'system',
      newState: { status: 'running', mode: workflowPlan.mode },
    });

    let result: WorkflowExecutionResult;

    try {
      if (workflowPlan.mode === 'parallel') {
        result = await executeParallelWorkflow(
          workflowPlan,
          assignments,
          task,
          this.assignmentExecutor,
          this.runningWorkflows
        );
      } else {
        result = await executeSerialWorkflow(
          workflowPlan,
          assignments,
          task,
          this.assignmentExecutor,
          this.runningWorkflows
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result = {
        workflowPlanId: workflowPlan.id,
        status: 'failed',
        completedSteps: [],
        assignments,
        error: errorMessage,
      };
    }

    await this.finalizeExecution(workflowPlan, result);

    return result;
  }

  async resume(workflowPlanId: string): Promise<void> {
    const running = this.runningWorkflows.get(workflowPlanId);
    if (running && running.status === 'skipped') {
      this.runningWorkflows.set(workflowPlanId, {
        ...running,
        status: 'running',
      });

      await this.logAuditEvent({
        entityType: 'execution',
        entityId: workflowPlanId,
        action: 'resumed',
        actor: 'system',
        previousState: { status: 'skipped' },
        newState: { status: 'running' },
      });
    }
  }

  async cancel(workflowPlanId: string): Promise<void> {
    await cancelWorkflow(
      workflowPlanId,
      this.store,
      this.assignmentExecutor,
      this.runningWorkflows,
      this.auditLogger ? (event) => this.logAuditEvent(event as any) : undefined
    );
  }

  getStatus(workflowPlanId: string): WorkflowExecutionStatus {
    const running = this.runningWorkflows.get(workflowPlanId);
    return {
      workflowPlanId,
      status: running?.status ?? 'planned',
      currentStep: running?.currentStep,
      completedSteps: running ? Array.from(running.completedSteps) : [],
      pendingSteps: [],
      startedAt: running?.startedAt,
      endedAt: undefined,
    };
  }

  private async updateWorkflowStatus(taskId: string, status: WorkflowPlan['status']): Promise<void> {
    await this.store.updateWorkflowPlan(taskId, (current) => ({
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    }));
  }

  private async finalizeExecution(workflowPlan: WorkflowPlan, result: WorkflowExecutionResult): Promise<void> {
    if (result.status === 'completed') {
      await this.updateWorkflowStatus(workflowPlan.taskId, 'completed');
      await this.store.updateTask(workflowPlan.taskId, (current) => ({
        ...current,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      }));
    } else if (result.status === 'failed') {
      await this.updateWorkflowStatus(workflowPlan.taskId, 'failed');
      await this.store.updateTask(workflowPlan.taskId, (current) => ({
        ...current,
        status: 'failed',
        updatedAt: new Date().toISOString(),
      }));
    }

    const running = this.runningWorkflows.get(workflowPlan.id);
    if (running) {
      this.runningWorkflows.set(workflowPlan.id, {
        ...running,
        status: result.status === 'skipped' ? 'skipped' : running.status,
      });
    }

    await this.logAuditEvent({
      entityType: 'execution',
      entityId: workflowPlan.id,
      action: result.status === 'skipped' ? 'cancelled' : result.status,
      actor: 'system',
      previousState: { status: 'running' },
      newState: {
        status: result.status,
        completedSteps: result.completedSteps.length,
        failedStep: result.failedStep,
      },
    });
  }

  private async logAuditEvent(event: {
    entityType: 'execution';
    entityId: string;
    action: string;
    actor: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    reason?: string;
  }): Promise<void> {
    if (this.auditLogger) {
      await this.store.logAudit?.(event as AuditEvent);
    }
  }
}

/**
 * Factory function to create a WorkflowExecutionEngine
 */
export function createWorkflowExecutionEngine(config: WorkflowExecutionEngineConfig): WorkflowExecutionEngine {
  return new DefaultWorkflowExecutionEngine(config);
}
