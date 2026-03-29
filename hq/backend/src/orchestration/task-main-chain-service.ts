import type { Store } from '../store';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type {
  TaskRecord,
  ApprovalRecord,
  TaskStatus,
} from '../shared/task-types';
import { TaskLifecycleService, type CreateTaskInput } from './task-lifecycle-service';
import { TaskStateMachine } from './task-state-machine';
import { executeTaskAfterApproval, type ApprovalExecutionBridgeDependencies } from './approval-execution-bridge';

export type MainChainExecutor = 'claude' | 'codex' | 'openai' | 'deerflow';

export interface MainChainInput {
  title: string;
  description: string;
  taskType?: string;
  priority?: string;
  executionMode?: string;
  requestedBy: string;
  executor?: MainChainExecutor;
  timeoutMs?: number;
  maxRetries?: number;
  skipExecution?: boolean;
}

export interface MainChainApprovalInput {
  approvalId: string;
  decision: 'approved' | 'rejected';
  approver: string;
  reason?: string;
  executor?: MainChainExecutor;
  timeoutMs?: number;
  maxRetries?: number;
  skipExecution?: boolean;
}

export type MainChainPath = 'direct' | 'approval' | 'workflow';

export interface MainChainResult {
  task: TaskRecord;
  approval?: ApprovalRecord;
  execution?: ExecutionLifecycleRecord;
  path: MainChainPath;
  status: TaskStatus;
}

export interface MainChainDependencies {
  store: Store;
  auditLogger?: {
    log: (event: import('../governance/audit-logger').AuditEvent) => Promise<void>;
  };
  executionDeps?: ApprovalExecutionBridgeDependencies;
}

function resolveExecutor(executor?: MainChainExecutor): MainChainExecutor {
  return executor ?? 'claude';
}

export class TaskMainChainService {
  private lifecycle: TaskLifecycleService;
  private stateMachine: TaskStateMachine;
  private store: Store;
  private executionDeps: ApprovalExecutionBridgeDependencies;

  constructor(private deps: MainChainDependencies) {
    this.store = deps.store;
    this.executionDeps = deps.executionDeps ?? {};

    this.lifecycle = new TaskLifecycleService({
      store: this.store,
      auditLogger: deps.auditLogger,
    });

    this.stateMachine = new TaskStateMachine(
      {
        list: () => this.store.getTasks(),
        getById: (id: string) => this.store.getTaskById(id),
        save: (task: TaskRecord) => this.store.saveTask(task),
        update: (id: string, updater: (t: TaskRecord) => TaskRecord) =>
          this.store.updateTask(id, updater),
      },
      null
    );
  }

  async execute(input: MainChainInput): Promise<MainChainResult> {
    const task = await this.lifecycle.createTask(input);

    if (task.status === 'waiting_approval') {
      const approvals = await this.store.getApprovalsByTaskId?.(task.id);
      const pendingApproval = approvals?.find((a) => a.status === 'pending');
      return {
        task,
        approval: pendingApproval,
        path: 'approval',
        status: task.status,
      };
    }

    const executor = resolveExecutor(input.executor);
    const isWorkflow =
      task.executionMode === 'serial' ||
      task.executionMode === 'parallel' ||
      task.executionMode === 'advanced_discussion';

    const path: MainChainPath = isWorkflow ? 'workflow' : 'direct';

    if (input.skipExecution) {
      return { task, path, status: task.status };
    }

    const execution = await this.runExecution(task, {
      executor,
      summary: `完成任务：${task.title}`,
      topic: `${task.title}\n\n${task.description}`,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
    });

    const finalTask = await this.store.getTaskById(task.id);

    return {
      task: finalTask ?? task,
      execution: execution.execution,
      path,
      status: (finalTask ?? task).status,
    };
  }

  async resolveApproval(input: MainChainApprovalInput): Promise<MainChainResult> {
    const { approval, task: approvalTask } =
      await this.lifecycle.handleApprovalDecision(
        input.approvalId,
        input.decision,
        input.approver,
        input.reason
      );

    if (!approval || !approvalTask) {
      const fallbackTask = approval?.taskId
        ? await this.store.getTaskById(approval.taskId)
        : null;
      return {
        task: fallbackTask ?? approvalTask ?? ({ id: 'unknown' } as TaskRecord),
        approval: approval ?? undefined,
        path: 'approval',
        status: (fallbackTask ?? approvalTask)?.status ?? 'failed',
      };
    }

    if (input.decision === 'rejected') {
      return { task: approvalTask, approval, path: 'approval', status: approvalTask.status };
    }

    if (input.skipExecution) {
      return { task: approvalTask, approval, path: 'approval', status: approvalTask.status };
    }

    const executor = resolveExecutor(input.executor);
    const execution = await this.runExecution(approvalTask, {
      executor,
      summary: `完成任务：${approvalTask.title}`,
      topic: `${approvalTask.title}\n\n${approvalTask.description}`,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
    });

    const finalTask = await this.store.getTaskById(approvalTask.id);

    return {
      task: finalTask ?? approvalTask,
      approval,
      execution: execution.execution,
      path: 'approval',
      status: (finalTask ?? approvalTask).status,
    };
  }

  async cancel(taskId: string, actor: string, reason?: string): Promise<MainChainResult> {
    const task = await this.store.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === 'waiting_approval') {
      await this.lifecycle.cancelApproval(taskId, actor, reason);
    } else {
      await this.stateMachine.transition(taskId, 'cancel', actor, reason);
    }

    const finalTask = await this.store.getTaskById(taskId);

    return {
      task: finalTask ?? task,
      path: task.status === 'waiting_approval' ? 'approval' : 'direct',
      status: finalTask?.status ?? 'cancelled',
    };
  }

  private async runExecution(
    task: TaskRecord,
    opts: {
      executor: MainChainExecutor;
      summary: string;
      topic: string;
      timeoutMs?: number;
      maxRetries?: number;
    }
  ): Promise<{ execution: ExecutionLifecycleRecord }> {
    if (task.status !== 'routed' && task.status !== 'running') {
      await this.stateMachine.transition(task.id, 'route', 'system', 'Auto-route for execution');
      task = (await this.store.getTaskById(task.id)) ?? task;
    }

    return executeTaskAfterApproval(
      {
        taskId: task.id,
        executor: opts.executor,
        summary: opts.summary,
        topic: opts.topic,
        timeoutMs: opts.timeoutMs,
        maxRetries: opts.maxRetries,
      },
      this.store,
      this.executionDeps
    );
  }
}

export function createTaskMainChainService(
  deps: MainChainDependencies
): TaskMainChainService {
  return new TaskMainChainService(deps);
}
