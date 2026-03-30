import path from 'node:path';
import type { WorkflowPlan, TaskAssignment, TaskRecord } from '../shared/task-types';
import type { AuditLogger, AuditEvent } from '../governance/audit-logger';
import type { Store } from '../store';
import type { AssignmentExecutor } from './assignment-executor';
import { executeSerialWorkflow, executeParallelWorkflow } from './workflow-execution-serial';
import { cancelWorkflow } from './workflow-execution-cancel';
import { TaskController, type ExecutionState, type PauseOptions } from '../runtime/task-controller';
import { ExecutionStateStore } from '../runtime/execution-store';
import { createRuntimePaths } from '../runtime/runtime-state';
import { createSelfHealingService, type SelfHealingService, type HealingAttempt } from '../runtime/self-healing-service';

/**
 * Status of workflow execution
 */
export interface WorkflowExecutionStatus {
  workflowPlanId: string;
  status: 'planned' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
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
   * Pause a running workflow
   */
  pause(workflowPlanId: string, options?: PauseOptions): Promise<void>;

  /**
   * Resume a previously paused or cancelled workflow
   */
  resume(workflowPlanId: string): Promise<void>;

  /**
   * Resume a workflow from a specific checkpoint (HITL)
   */
  resumeFromCheckpoint(workflowPlanId: string, checkpointData: any): Promise<WorkflowExecutionResult>;

  /**
   * Cancel a running workflow
   */
  cancel(workflowPlanId: string): Promise<void>;

  /**
   * Get current execution status
   */
  getStatus(workflowPlanId: string): WorkflowExecutionStatus;

  /**
   * Get detailed execution state including pause/resume information
   */
  getExecutionState(workflowPlanId: string): Promise<ExecutionState | null>;

  /**
   * Initialize the engine by restoring state from ExecutionStateStore
   */
  initialize(): Promise<void>;
}

/**
 * Internal tracking of running workflows
 */
export interface RunningWorkflow {
  workflowPlanId: string;
  status: 'running' | 'paused' | 'skipped' | 'completed' | 'failed';
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
  scanner?: any; // Scanner for agent replacement
}

/**
 * Default implementation of WorkflowExecutionEngine
 */
export class DefaultWorkflowExecutionEngine implements WorkflowExecutionEngine {
  private readonly store: WorkflowExecutionEngineConfig['store'];
  private readonly assignmentExecutor: AssignmentExecutor;
  private readonly auditLogger: WorkflowExecutionEngineConfig['auditLogger'];
  private readonly runningWorkflows = new Map<string, RunningWorkflow>();
  private readonly terminalWorkflowStatus = new Map<
    string,
    { status: 'completed' | 'failed' | 'skipped'; completedSteps: string[] }
  >();
  private readonly taskController: TaskController;
  private readonly executionStore: ExecutionStateStore;
  private readonly selfHealingService: SelfHealingService;

  constructor(config: WorkflowExecutionEngineConfig) {
    this.store = config.store;
    this.assignmentExecutor = config.assignmentExecutor;
    this.auditLogger = config.auditLogger;

    const runtimePaths = createRuntimePaths();
    const stateDir = path.join(runtimePaths.sessionsDir, 'executions');
    this.executionStore = new ExecutionStateStore(stateDir);
    this.taskController = new TaskController(this.executionStore);
    this.selfHealingService = createSelfHealingService({}, config.scanner);

    this.initialize().catch((error) => {
      console.error('Failed to initialize WorkflowExecutionEngine:', error);
    });
  }

  async initialize(): Promise<void> {
    const allStates = await this.executionStore.listAll();
    for (const state of allStates) {
      if (state.status === 'running' || state.status === 'paused') {
        const checkpointData = state.checkpointData as {
          startedAt?: string;
          completedSteps?: string[];
          currentStep?: string;
        } | undefined;

        this.runningWorkflows.set(state.executionId, {
          workflowPlanId: state.executionId,
          status: state.status === 'running' ? 'running' : 'paused',
          startedAt: state.startedAt,
          completedSteps: new Set(checkpointData?.completedSteps ?? []),
          currentStep: checkpointData?.currentStep,
        });
      }
    }
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

    this.terminalWorkflowStatus.delete(workflowPlan.id);
    this.runningWorkflows.set(workflowPlan.id, {
      workflowPlanId: workflowPlan.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedSteps: new Set(),
    });

    // Save initial state to ExecutionStateStore to satisfy TaskController requirements
    await this.executionStore.save({
      executionId: workflowPlan.id,
      status: 'running',
      taskId: workflowPlan.taskId,
      executor: 'claude', // Default executor for workflows
      startedAt: new Date().toISOString(),
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
          this.runningWorkflows,
          this.selfHealingService
        );
      } else {
        result = await executeSerialWorkflow(
          workflowPlan,
          assignments,
          task,
          this.assignmentExecutor,
          this.runningWorkflows,
          this.selfHealingService
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

    // Clear healing attempts after workflow completion
    this.selfHealingService.clearAttempts(workflowPlan.taskId);

    return result;
  }

  async pause(workflowPlanId: string, options?: PauseOptions): Promise<void> {
    const running = this.runningWorkflows.get(workflowPlanId);
    if (running) {
      this.runningWorkflows.set(workflowPlanId, {
        ...running,
        status: 'paused',
      });
    }

    await this.taskController.pause(workflowPlanId, options);

    await this.logAuditEvent({
      entityType: 'execution',
      entityId: workflowPlanId,
      action: 'paused',
      actor: 'system',
      newState: { status: 'paused', checkpoint: !!options?.checkpointData },
    });
  }

  async resume(workflowPlanId: string): Promise<void> {
    const executionState = await this.executionStore.load(workflowPlanId);
    if (!executionState) {
      return;
    }

    if (executionState.status !== 'paused') {
      return;
    }

    const running = this.runningWorkflows.get(workflowPlanId);
    if (running) {
      this.runningWorkflows.set(workflowPlanId, {
        ...running,
        status: 'running',
      });
    } else if (executionState.checkpointData) {
      const checkpointData = executionState.checkpointData as {
        startedAt?: string;
        completedSteps?: string[];
        currentStep?: string;
      };
      this.runningWorkflows.set(workflowPlanId, {
        workflowPlanId,
        status: 'running',
        startedAt: executionState.startedAt,
        completedSteps: new Set(checkpointData.completedSteps ?? []),
        currentStep: checkpointData.currentStep,
      });
    }

    await this.taskController.resume(workflowPlanId);

    if (executionState.taskId) {
      const workflow = await this.store.getWorkflowPlanByTaskId(executionState.taskId);
      if (workflow) {
        await this.store.updateWorkflowPlan(executionState.taskId, (current) => ({
          ...current,
          status: 'running',
          updatedAt: new Date().toISOString(),
        }));
      }
    }

    await this.logAuditEvent({
      entityType: 'execution',
      entityId: workflowPlanId,
      action: 'resumed',
      actor: 'system',
      previousState: { status: 'paused' },
      newState: { status: 'running' },
    });
  }

  async resumeFromCheckpoint(workflowPlanId: string, checkpointData: any): Promise<WorkflowExecutionResult> {
    const workflowPlan = await this.store.getWorkflowPlanByTaskId(checkpointData.taskId);
    const task = await this.store.getTaskById(checkpointData.taskId);
    const assignments = await this.store.getTaskAssignmentsByTaskId(checkpointData.taskId);

    if (!workflowPlan || !task || !assignments.length) {
      throw new Error(`Cannot resume workflow ${workflowPlanId}: missing core data`);
    }

    // Set as running in engine
    this.runningWorkflows.set(workflowPlanId, {
      workflowPlanId,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedSteps: new Set(checkpointData.completedSteps || []),
      currentStep: checkpointData.currentStep,
    });

    await this.updateWorkflowStatus(task.id, 'running');

    await this.logAuditEvent({
      entityType: 'execution',
      entityId: workflowPlanId,
      action: 'resumed_from_checkpoint',
      actor: 'system',
      newState: { status: 'running', checkpointData },
    });

    let result: WorkflowExecutionResult;

    try {
      if (workflowPlan.mode === 'parallel') {
        result = await executeParallelWorkflow(
          workflowPlan,
          assignments,
          task,
          this.assignmentExecutor,
          this.runningWorkflows,
          this.selfHealingService
        );
      } else {
        result = await executeSerialWorkflow(
          workflowPlan,
          assignments,
          task,
          this.assignmentExecutor,
          this.runningWorkflows,
          this.selfHealingService
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result = {
        workflowPlanId,
        status: 'failed',
        completedSteps: Array.from(this.runningWorkflows.get(workflowPlanId)?.completedSteps || []),
        assignments,
        error: errorMessage,
      };
    }

    await this.finalizeExecution(workflowPlan, result);
    return result;
  }

  async cancel(workflowPlanId: string): Promise<void> {
    await cancelWorkflow(
      workflowPlanId,
      this.store,
      this.assignmentExecutor,
      this.runningWorkflows,
      this.auditLogger ? (event) => this.logAuditEvent(event as any) : undefined
    );
    // Only cancel in task controller if execution state exists
    const executionState = await this.executionStore.load(workflowPlanId);
    if (executionState) {
      await this.taskController.cancel(workflowPlanId);
    }
  }

  getStatus(workflowPlanId: string): WorkflowExecutionStatus {
    const terminal = this.terminalWorkflowStatus.get(workflowPlanId);
    if (terminal) {
      return {
        workflowPlanId,
        status: terminal.status,
        completedSteps: terminal.completedSteps,
        pendingSteps: [],
        endedAt: new Date().toISOString(),
      };
    }
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

  async getExecutionState(workflowPlanId: string): Promise<ExecutionState | null> {
    return await this.executionStore.load(workflowPlanId);
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
      const nextStatus: RunningWorkflow['status'] =
        result.status === 'skipped'
          ? 'skipped'
          : result.status === 'completed'
            ? 'completed'
            : result.status === 'failed'
              ? 'failed'
              : running.status;
      this.runningWorkflows.set(workflowPlan.id, {
        ...running,
        status: nextStatus,
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
