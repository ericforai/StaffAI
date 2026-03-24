import { beginExecution, completeExecution } from './execution-service';
import type { ExecutionLifecycleRecord } from './execution-service';
import type { Store } from '../store';
import type { TaskRecord } from '../shared/task-types';

export interface AdvancedDiscussionRunnerDeps {
  runAdvancedDiscussion?: (task: TaskRecord) => Promise<{ summary: string }>;
}

export async function runAdvancedDiscussionExecution(
  task: TaskRecord,
  executor: 'claude' | 'codex' | 'openai',
  store: Pick<Store, 'saveExecution' | 'updateExecution' | 'updateTask'>,
  runner?: AdvancedDiscussionRunnerDeps['runAdvancedDiscussion']
): Promise<{
  execution: ExecutionLifecycleRecord;
  task: TaskRecord | null;
}> {
  const execution = beginExecution({
    taskId: task.id,
    executor,
  });

  store.saveExecution(execution);

  if (!runner) {
    return {
      execution,
      task,
    };
  }

  const result = await runner(task);
  const completed = completeExecution(execution, { summary: result.summary });
  store.updateExecution(execution.id, () => completed);
  const updatedTask = store.updateTask(task.id, (currentTask) => ({
    ...currentTask,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  }));

  return {
    execution: completed,
    task: updatedTask,
  };
}
