import type { Store } from '../store';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';
import { executeTaskRecord } from './task-execution-orchestrator';

export interface ApprovalExecutionBridgeDependencies {
  onExecutionStarted?: (input: { taskId: string; executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow' }) => void;
  onExecutionFinished?: (execution: ExecutionLifecycleRecord) => void;
  onEvent?: (event: { type: string; data: any }) => void;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined | void> | string | undefined | void;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionLifecycleRecord) => Promise<void> | void;
  sessionCapabilities?: { sampling: boolean };
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
}

export async function executeTaskAfterApproval(
  input: {
    taskId: string;
    executor: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow';
    summary?: string;
    topic?: string;
    timeoutMs?: number;
    maxRetries?: number;
  },
  store: Store,
  deps: ApprovalExecutionBridgeDependencies = {}
): Promise<{
  execution: ExecutionLifecycleRecord;
  task: TaskRecord | null;
}> {
  const task = await store.getTaskById(input.taskId);
  if (!task) {
    throw new Error(`task not found: ${input.taskId}`);
  }

  const validStatuses: string[] = ['routed', 'running'];
  if (!validStatuses.includes(task.status)) {
    throw new Error(`task is not executable after approval: status is ${task.status}`);
  }

  // Reflect the "execution has begun" state transition explicitly for the approval-triggered path.
  await store.updateTask(task.id, (current) => ({
    ...current,
    status: 'running',
    updatedAt: new Date().toISOString(),
  }));

  const topic = input.topic?.trim() ? input.topic.trim() : `${task.title}\n\n${task.description}`;
  const summary = input.summary?.trim() ? input.summary.trim() : `完成任务：${task.title}`;

  deps.onExecutionStarted?.({ taskId: task.id, executor: input.executor });

  // If task status was restored to 'running' or it was a high-risk tool intervention,
  // we assume the next run is authorized for that specific tool action.
  const approvalGranted = true;

  const result = await executeTaskRecord(
    task,
    {
      executor: input.executor,
      summary,
      approvalGranted,
      ...(typeof input.timeoutMs === 'number' ? { timeoutMs: input.timeoutMs } : {}),
      ...(typeof input.maxRetries === 'number' ? { maxRetries: input.maxRetries } : {}),
    },
    store,
    {
      runAdvancedDiscussion: deps.runAdvancedDiscussion
        ? async () => deps.runAdvancedDiscussion?.(topic) ?? { summary }
        : undefined,
      loadMemoryContext: deps.loadMemoryContext,
      writeExecutionSummary: deps.writeExecutionSummary,
      sessionCapabilities: deps.sessionCapabilities,
      onEvent: deps.onEvent,
    }
  );

  deps.onExecutionFinished?.(result.execution);

  return {
    execution: result.execution,
    task: result.task,
  };
}

