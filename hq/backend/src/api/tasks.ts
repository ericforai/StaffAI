import type express from 'express';
import type { AgentProfile } from '../types';
import type { Store } from '../store';
import type { Scanner } from '../scanner';
import { createTaskDraft, validateTaskDraft } from '../orchestration/task-orchestrator';
import { executeTaskRecord } from '../orchestration/task-execution-orchestrator';
import {
  buildTaskDetailReadModel,
  buildTaskListReadModel,
  buildTaskWorkspaceSummary,
} from '../orchestration/task-read-model';
import { runMvpScenario } from '../orchestration/mvp-scenario-runner';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import { TASK_EXECUTION_MODES, type TaskExecutionMode, type TaskRecord } from '../shared/task-types';

interface TaskRouteDependencies {
  getAgentProfiles?: () => AgentProfile[];
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
  onTaskCreated?: (task: TaskRecord) => void;
  onApprovalRequested?: (taskId: string) => Promise<void> | void;
  onExecutionStarted?: (input: { taskId: string; executor: 'claude' | 'codex' | 'openai' }) => void;
  onExecutionFinished?: (execution: ExecutionLifecycleRecord) => void;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined | void> | string | undefined | void;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionLifecycleRecord) => Promise<void> | void;
  sessionCapabilities?: { sampling: boolean };
}

function readExecutionMode(value: unknown): TaskExecutionMode | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return (TASK_EXECUTION_MODES as readonly string[]).includes(value) ? (value as TaskExecutionMode) : undefined;
}

function readPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

function pickLatestExecution(executions: ExecutionLifecycleRecord[]): ExecutionLifecycleRecord | undefined {
  return executions.slice().sort((left, right) => {
    const leftTime = Date.parse(left.completedAt || left.startedAt || '1970-01-01T00:00:00.000Z');
    const rightTime = Date.parse(right.completedAt || right.startedAt || '1970-01-01T00:00:00.000Z');
    return rightTime - leftTime;
  })[0];
}

function pickWorkflowArtifacts(detail: Awaited<ReturnType<typeof buildTaskDetailReadModel>>) {
  if (!detail) {
    return {};
  }

  if (detail.workflowPlan || detail.assignments.length > 0) {
    return {
      workflowPlan: detail.workflowPlan,
      assignments: detail.assignments,
    };
  }

  const latestExecution = pickLatestExecution(detail.executions as ExecutionLifecycleRecord[]);
  return {
    ...(latestExecution?.workflowPlan ? { workflowPlan: latestExecution.workflowPlan } : {}),
    ...(latestExecution?.assignments ? { assignments: latestExecution.assignments } : {}),
  };
}

export function registerTaskRoutes(
  app: express.Application,
  store: Store,
  dependencies: TaskRouteDependencies = {}
) {
  app.get('/api/tasks', async (_req, res) => {
    const tasks = await buildTaskListReadModel(store);
    const summary = await buildTaskWorkspaceSummary(tasks);
    return res.json({ tasks, summary });
  });

  app.get('/api/tasks/:id', async (req, res) => {
    const detail = await buildTaskDetailReadModel(req.params.id, store);
    if (!detail) {
      return res.status(404).json({
        error: 'task not found',
        taskId: req.params.id,
      });
    }

    return res.json({
      ...detail,
      ...pickWorkflowArtifacts(detail),
    });
  });

  app.post('/api/tasks/:id/execute', async (req, res) => {
    const task = await store.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: 'task not found',
        taskId: req.params.id,
      });
    }

    if (task.status !== 'created' && task.status !== 'routed') {
      return res.status(409).json({
        error: 'task is not executable in its current state',
        taskId: req.params.id,
      });
    }

    const executor = req.body?.executor === 'claude' || req.body?.executor === 'openai' ? req.body.executor : 'codex';
    const executionMode = readExecutionMode(req.body?.executionMode);
    const timeoutMs = readPositiveInt(req.body?.timeoutMs);
    const maxRetries = readPositiveInt(req.body?.maxRetries);
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

    const result = await executeTaskRecord(
      task,
      {
        executor,
        summary,
        ...(executionMode ? { executionMode } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
        ...(typeof maxRetries === 'number' ? { maxRetries } : {}),
      },
      store,
      {
        runAdvancedDiscussion: dependencies.runAdvancedDiscussion
          ? async () => dependencies.runAdvancedDiscussion?.(topic) ?? { summary }
          : undefined,
        loadMemoryContext: dependencies.loadMemoryContext,
        writeExecutionSummary: dependencies.writeExecutionSummary,
        sessionCapabilities: dependencies.sessionCapabilities,
      },
    );

    dependencies.onExecutionFinished?.(result.execution);

    return res.status(201).json({
      ...result,
    });
  });

  app.post('/api/tasks', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    const description = typeof req.body?.description === 'string' ? req.body.description : '';
    const taskType = typeof req.body?.taskType === 'string' ? req.body.taskType : undefined;
    const priority = typeof req.body?.priority === 'string' ? req.body.priority : undefined;
    const requestedBy = typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : undefined;
    const executionMode = typeof req.body?.executionMode === 'string' ? req.body.executionMode : undefined;
    const validation = validateTaskDraft({ title, description, taskType, priority, requestedBy, executionMode });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const task = await createTaskDraft(
      { title, description, taskType, priority, requestedBy, executionMode },
      store,
      {
        getAgentProfiles: dependencies.getAgentProfiles,
      },
    );
    dependencies.onTaskCreated?.(task);

    if (task.approvalRequired) {
      await dependencies.onApprovalRequested?.(task.id);
    }

    return res.status(201).json({
      task,
    });
  });
}

/**
 * Register the MVP scenario endpoint.
 * Separate from registerTaskRoutes to avoid breaking existing callers.
 */
export function registerScenarioRoutes(
  app: express.Application,
  store: Store,
  scanner: Scanner,
) {
  app.post('/api/tasks/scenario', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const presetName = typeof req.body?.presetName === 'string' ? req.body.presetName : undefined;
    const executionMode = readExecutionMode(req.body?.executionMode);
    const requestedBy = typeof req.body?.requestedBy === 'string' ? req.body.requestedBy : undefined;

    try {
      const result = await runMvpScenario(
        {
          title,
          description,
          presetName,
          executionMode,
          requestedBy,
        },
        store,
        scanner,
      );

      return res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'PresetNotFoundError') {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
  });
}
