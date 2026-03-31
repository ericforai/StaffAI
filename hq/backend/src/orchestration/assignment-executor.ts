import { randomUUID } from 'node:crypto';
import type { TaskAssignment, TaskRecord, TaskAssignmentStatus } from '../shared/task-types';
import type { PendingHumanInput } from '../shared/hitl-types';
import type { RuntimeExecutionContext, RuntimeExecutionResult } from '../runtime/runtime-adapter';
import { resolveRuntimeAdapter, resolveRuntimeName } from '../runtime/runtime-adapter';
import type { AuditLogger, AuditEvent } from '../governance/audit-logger';
import type { Store } from '../store';
import { executeAssignmentWithRetry, trackRunningAssignment, type AssignmentExecutionWithRetryResult } from './assignment-execution-runner';
import { updateAssignmentExecutionStatus, markAssignmentCompleted, markAssignmentFailed } from './assignment-status-updater';
import { logAssignmentAuditEvent } from './assignment-audit-logger';
import { resolveTaskTimeoutMs } from '../runtime/task-execution-config';

/**
 * Status of assignment execution
 */
export type AssignmentExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Result of assignment execution
 */
export interface AssignmentResult {
  assignmentId: string;
  status: 'completed' | 'failed' | 'waiting_input';
  outputSummary?: string;
  outputSnapshot?: Record<string, unknown>;
  error?: string;
  retryCount?: number;
}

/**
 * Input for assignment execution
 */
export interface AssignmentExecutionInput {
  taskId: string;
  title: string;
  description: string;
  executor: 'claude' | 'codex' | 'openai' | 'deerflow';
  timeoutMs?: number;
  maxRetries?: number;
  memoryContextExcerpt?: string;
  approvalGranted?: boolean;
}

/**
 * Executor for individual task assignments
 * Handles single assignment execution with runtime integration
 */
export interface AssignmentExecutor {
  /**
   * Execute a single assignment
   */
  execute(assignment: TaskAssignment, input: AssignmentExecutionInput): Promise<AssignmentResult>;

  /**
   * Resume a previously cancelled/failed assignment
   */
  resume(assignmentId: string): Promise<void>;

  /**
   * Cancel a running assignment
   */
  cancel(assignmentId: string): Promise<void>;

  /**
   * Get current execution status
   */
  getStatus(assignmentId: string): AssignmentExecutionStatus;
}

/**
 * Internal tracking of running assignments
 */
interface RunningAssignment {
  assignmentId: string;
  status: AssignmentExecutionStatus;
  startedAt?: string;
  abortController?: AbortController;
  cancelled?: boolean;
}

/**
 * Configuration for AssignmentExecutor
 */
export interface AssignmentExecutorConfig {
  store: Pick<Store, 'getTaskById' | 'updateTaskAssignment' | 'saveExecution' | 'logAudit' | 'savePendingHumanInput'> & Partial<Pick<Store, 'getTaskAssignments'>>;
  auditLogger: AuditLogger | null;
  executor: 'claude' | 'codex' | 'openai' | 'deerflow';
  timeoutMs?: number;
}

/**
 * Default implementation of AssignmentExecutor
 */
export class DefaultAssignmentExecutor implements AssignmentExecutor {
  private readonly store: AssignmentExecutorConfig['store'];
  private readonly auditLogger: AssignmentExecutorConfig['auditLogger'];
  private readonly defaultExecutor: 'claude' | 'codex' | 'openai' | 'deerflow';
  private readonly defaultTimeoutMs: number;
  private readonly runningAssignments = new Map<string, RunningAssignment>();

  constructor(config: AssignmentExecutorConfig) {
    this.store = config.store;
    this.auditLogger = config.auditLogger;
    this.defaultExecutor = config.executor;
    this.defaultTimeoutMs = resolveTaskTimeoutMs(config.timeoutMs);
  }

  async execute(assignment: TaskAssignment, input: AssignmentExecutionInput): Promise<AssignmentResult> {
    const timeoutMs = resolveTaskTimeoutMs(input.timeoutMs ?? this.defaultTimeoutMs);
    const executor = input.executor ?? this.defaultExecutor;
    const maxRetries = input.maxRetries ?? 1;

    // Check if already completed
    if (assignment.status === 'completed') {
      return {
        assignmentId: assignment.id,
        status: 'completed',
        outputSummary: assignment.resultSummary,
      };
    }

    trackRunningAssignment(this.runningAssignments, assignment.id, 'running');

    await updateAssignmentExecutionStatus(this.store, assignment.id, 'running');

    const task = await this.store.getTaskById(input.taskId);
    if (!task) {
      await markAssignmentFailed(this.store, assignment.id, 'Task not found');
      return {
        assignmentId: assignment.id,
        status: 'failed',
        error: 'Task not found',
      };
    }

    await logAssignmentAuditEvent(this.store, this.auditLogger, {
      entityType: 'execution',
      entityId: assignment.id,
      action: 'started',
      actor: 'system',
      newState: { status: 'running', assignmentId: assignment.id },
    });

    const runtimeAdapter = resolveRuntimeAdapter(executor);
    const runtimeContext = this.buildRuntimeContext(assignment, task, input, executor, timeoutMs);

    const result = await executeAssignmentWithRetry(
      runtimeAdapter.run(runtimeContext),
      timeoutMs,
      maxRetries,
      this.isRetriableError.bind(this)
    );

    if (result.success) {
      // Check if runtime signaled need for human input
      if (result.needsHumanInput) {
        await this.handleHumanInputNeeded(assignment, input, result);
        return {
          assignmentId: assignment.id,
          status: 'completed',
          outputSummary: result.outputSummary,
          outputSnapshot: result.outputSnapshot,
          retryCount: result.attempts,
        };
      }

      await markAssignmentCompleted(this.store, this.defaultExecutor, assignment.id, result.outputSummary, result.outputSnapshot, resolveRuntimeName);
      this.runningAssignments.set(assignment.id, { assignmentId: assignment.id, status: 'completed' });

      await logAssignmentAuditEvent(this.store, this.auditLogger, {
        entityType: 'execution',
        entityId: assignment.id,
        action: 'completed',
        actor: 'system',
        previousState: { status: 'running' },
        newState: { status: 'completed', outputSummary: result.outputSummary },
      });

      return {
        assignmentId: assignment.id,
        status: 'completed',
        outputSummary: result.outputSummary,
        outputSnapshot: result.outputSnapshot,
        retryCount: result.attempts,
      };
    } else {
      await markAssignmentFailed(this.store, assignment.id, result.error ?? '执行失败');
      return {
        assignmentId: assignment.id,
        status: 'failed',
        error: result.error,
        retryCount: result.attempts,
      };
    }
  }

  async resume(assignmentId: string): Promise<void> {
    const running = this.runningAssignments.get(assignmentId);
    if (running && running.cancelled) {
      this.runningAssignments.set(assignmentId, {
        assignmentId,
        status: 'idle',
      });
    }
  }

  async cancel(assignmentId: string): Promise<void> {
    const running = this.runningAssignments.get(assignmentId);
    if (running) {
      running.abortController?.abort();
      this.runningAssignments.set(assignmentId, {
        assignmentId,
        status: 'skipped',
        cancelled: true,
      });
      await updateAssignmentExecutionStatus(this.store, assignmentId, 'skipped');

      await logAssignmentAuditEvent(this.store, this.auditLogger, {
        entityType: 'execution',
        entityId: assignmentId,
        action: 'cancelled',
        actor: 'system',
        previousState: { status: running.status },
        newState: { status: 'skipped' },
      });
    }
  }

  getStatus(assignmentId: string): AssignmentExecutionStatus {
    return this.runningAssignments.get(assignmentId)?.status ?? 'idle';
  }

  private buildRuntimeContext(
    assignment: TaskAssignment,
    task: TaskRecord,
    input: AssignmentExecutionInput,
    executor: 'claude' | 'codex' | 'openai' | 'deerflow',
    timeoutMs: number
  ): RuntimeExecutionContext {
    return {
      task,
      executor,
      runtimeName: resolveRuntimeName(executor),
      assignmentId: assignment.id,
      workflowStepId: assignment.stepId,
      executionMode: task.executionMode,
      summary: input.description,
      memoryContextExcerpt: input.memoryContextExcerpt,
      timeoutMs,
      maxRetries: input.maxRetries ?? 1,
      approvalGranted: input.approvalGranted,
      inputSnapshot: {
        assignmentId: assignment.id,
        agentId: assignment.agentId,
        assignmentRole: assignment.assignmentRole,
      },
    };
  }

  private async handleHumanInputNeeded(
    assignment: TaskAssignment,
    input: AssignmentExecutionInput,
    result: AssignmentExecutionWithRetryResult
  ): Promise<void> {
    // Extract questions from output summary - runtime sends {{HITL_NEED_INPUT}} marker
    const questions = result.outputSummary?.replace(/{{HITL_NEED_INPUT}}/g, '').trim() || 'Human input needed';

    const pendingInput: PendingHumanInput = {
      id: randomUUID(),
      assignmentId: assignment.id,
      taskId: input.taskId,
      questions,
      outputSnapshot: result.outputSnapshot,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.store.savePendingHumanInput(pendingInput);
    await updateAssignmentExecutionStatus(this.store, assignment.id, 'waiting_input');

    this.runningAssignments.set(assignment.id, { assignmentId: assignment.id, status: 'idle' });

    await logAssignmentAuditEvent(this.store, this.auditLogger, {
      entityType: 'execution',
      entityId: assignment.id,
      action: 'waiting_input',
      actor: 'system',
      previousState: { status: 'running' },
      newState: { status: 'waiting_input', pendingInputId: pendingInput.id },
    });
  }

  private isRetriableError(error: string): boolean {
    return error.includes('timed out') || error.includes('unavailable');
  }
}

/**
 * Factory function to create an AssignmentExecutor
 */
export function createAssignmentExecutor(config: AssignmentExecutorConfig): AssignmentExecutor {
  return new DefaultAssignmentExecutor(config);
}
