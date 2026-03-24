import type express from 'express';
import type { Store } from '../store';
import { createTaskDraft, validateTaskDraft } from '../orchestration/task-orchestrator';
import { executeTaskRecord } from '../orchestration/task-execution-orchestrator';
import { buildTaskDetailReadModel, buildTaskListReadModel } from '../orchestration/task-read-model';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';

interface TaskRouteDependencies {
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
  onTaskCreated?: (task: TaskRecord) => void;
  onApprovalRequested?: (taskId: string) => Promise<void> | void;
  onExecutionStarted?: (input: { taskId: string; executor: 'claude' | 'codex' | 'openai' }) => void;
  onExecutionFinished?: (execution: ExecutionLifecycleRecord) => void;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined | void> | string | undefined | void;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionLifecycleRecord) => Promise<void> | void;
}

export function registerTaskRoutes(
  app: express.Application,
  store: Store,
  dependencies: TaskRouteDependencies = {}
) {
  app.get('/api/tasks', async (_req, res) => {
    const tasks = await buildTaskListReadModel(store);
    return res.json({
      tasks,
      stage: 'sprint-1-skeleton',
    });
  });

  app.get('/api/tasks/:id', async (req, res) => {
    const detail = await buildTaskDetailReadModel(req.params.id, store);
    if (!detail) {
      return res.status(404).json({
        error: 'task not found',
        taskId: req.params.id,
        stage: 'sprint-1-skeleton',
      });
    }

    return res.json({
      ...detail,
      stage: 'sprint-1-skeleton',
    });
  });

  app.post('/api/tasks/:id/execute', async (req, res) => {
    const task = await store.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: 'task not found',
        taskId: req.params.id,
        stage: 'sprint-1-skeleton',
      });
    }

    if (task.status !== 'created') {
      return res.status(409).json({
        error: 'task is not executable in its current state',
        taskId: req.params.id,
        stage: 'sprint-1-skeleton',
      });
    }

    const executor = req.body?.executor === 'claude' || req.body?.executor === 'openai' ? req.body.executor : 'codex';
    const summary =
      typeof req.body?.summary === 'string' && req.body.summary.trim()
        ? req.body.summary.trim()
        : `Execution completed for ${task.title}`;

    const topic =
      typeof req.body?.topic === 'string' && req.body.topic.trim()
        ? req.body.topic.trim()
        : `${task.title}\n\n${task.description}`;

    dependencies.onExecutionStarted?.({
      taskId: task.id,
      executor,
    });

    const result = await executeTaskRecord(task, { executor, summary }, store, {
      runAdvancedDiscussion: dependencies.runAdvancedDiscussion
        ? async () => dependencies.runAdvancedDiscussion?.(topic) ?? { summary }
        : undefined,
      loadMemoryContext: dependencies.loadMemoryContext,
      writeExecutionSummary: dependencies.writeExecutionSummary,
    });

    dependencies.onExecutionFinished?.(result.execution);

    return res.status(201).json({
      ...result,
      stage: 'sprint-1-skeleton',
    });
  });

  app.post('/api/tasks', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    const description = typeof req.body?.description === 'string' ? req.body.description : '';
    const executionMode = typeof req.body?.executionMode === 'string' ? req.body.executionMode : undefined;
    const validation = validateTaskDraft({ title, description });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const task = await createTaskDraft({ title, description, executionMode }, store);
    dependencies.onTaskCreated?.(task);

    if (task.approvalRequired) {
      await dependencies.onApprovalRequested?.(task.id);
    }

    return res.status(201).json({
      task,
      stage: 'sprint-1-skeleton',
    });
  });
}
