import type { Store } from '../store';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import { runTaskExecution } from '../runtime/execution-service';
import { runAdvancedDiscussionExecution } from '../runtime/advanced-discussion-runner';
import type { TaskRecord } from '../shared/task-types';

interface ExecuteTaskInput {
  executor: 'claude' | 'codex' | 'openai';
  summary: string;
}

interface TaskExecutionDependencies {
  runAdvancedDiscussion?: (task: TaskRecord) => Promise<{ summary: string }>;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined | void> | string | undefined | void;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionLifecycleRecord) => Promise<void> | void;
}

export async function executeTaskRecord(
  task: TaskRecord,
  input: ExecuteTaskInput,
  store: Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>,
  dependencies: TaskExecutionDependencies = {}
): Promise<{
  mode: TaskRecord['executionMode'];
  execution: ExecutionLifecycleRecord;
  task: TaskRecord | null;
}> {
  const loadedMemoryContext = await dependencies.loadMemoryContext?.(task);
  const memoryContextExcerpt =
    typeof loadedMemoryContext === 'string' && loadedMemoryContext.trim()
      ? loadedMemoryContext
      : undefined;

  if (task.executionMode === 'advanced_discussion') {
    const advancedResult = await runAdvancedDiscussionExecution(
      task,
      input.executor,
      store,
      dependencies.runAdvancedDiscussion
    );

    if (advancedResult.execution.status === 'completed') {
      await dependencies.writeExecutionSummary?.(advancedResult.task ?? task, advancedResult.execution);
    }

    return {
      mode: 'advanced_discussion',
      execution: advancedResult.execution,
      task: advancedResult.task ?? task,
    };
  }

  const result = runTaskExecution(
    {
      taskId: task.id,
      executor: input.executor,
      summary: input.summary,
      memoryContextExcerpt,
      executionMode: task.executionMode,
    },
    store
  );

  await dependencies.writeExecutionSummary?.(task, result.execution);

  return {
    mode: task.executionMode,
    ...result,
  };
}
