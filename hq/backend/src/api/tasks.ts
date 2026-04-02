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
  onExecutionStarted?: (input: { taskId: string; executor: 'claude' | 'codex' | 'openai' | 'deerflow' }) => void;
  onExecutionFinished?: (execution: ExecutionLifecycleRecord) => void;
  onExecutionEvent?: (input: { taskId: string; message: string; payload?: any }) => void;
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

// Simple in-memory rate limiter for execution endpoints
const executionRateLimit = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const entry = executionRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    executionRateLimit.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  entry.count++;
  return entry.count <= maxPerMinute;
}

function pickLatestExecution(executions: ExecutionLifecycleRecord[]): ExecutionLifecycleRecord | undefined {
  return executions.slice().sort((left, right) => {
    const leftTime = Date.parse(left.completedAt || left.startedAt || '1970-01-01T00:00:00.000Z');
    const rightTime = Date.parse(right.completedAt || right.startedAt || '1970-01-01T00:00:00.000Z');
    return rightTime - leftTime;
  })[0];
}

function resolveTaskExecutor(raw: unknown): 'claude' | 'codex' | 'openai' | 'deerflow' {
  if (raw === 'claude' || raw === 'codex' || raw === 'openai' || raw === 'deerflow') {
    return raw;
  }

  const envPreferred = process.env.AGENCY_TASK_EXECUTOR;
  if (envPreferred === 'claude' || envPreferred === 'codex' || envPreferred === 'openai' || envPreferred === 'deerflow') {
    return envPreferred;
  }

  // Default to claude since it supports MCP tools (web search, document reading)
  // Only use openai if explicitly configured via AGENCY_TASK_EXECUTOR
  return 'claude';
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
    if (!checkRateLimit(req.ip || 'unknown')) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
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

    const executor = resolveTaskExecutor(req.body?.executor);
    const executionMode = readExecutionMode(req.body?.executionMode);
    const timeoutMs = readPositiveInt(req.body?.timeoutMs);
    const maxRetries = readPositiveInt(req.body?.maxRetries);
    const summary =
      typeof req.body?.summary === 'string' && req.body.summary.trim()
        ? req.body.summary.trim()
        : `完成任务：${task.title}`;

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
        onEvent: (event) => {
          dependencies.onExecutionEvent?.({
            taskId: task.id,
            message: `Execution chunk received: ${event.type}`,
            payload: event.data,
          });
        },
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
    const assigneeId = typeof req.body?.assigneeId === 'string' ? req.body.assigneeId : undefined;
    const assigneeName = typeof req.body?.assigneeName === 'string' ? req.body.assigneeName : undefined;

    if (assigneeId && assigneeId.length > 100) {
      return res.status(400).json({ error: 'assigneeId too long (max 100 characters)' });
    }
    if (assigneeName && assigneeName.length > 200) {
      return res.status(400).json({ error: 'assigneeName too long (max 200 characters)' });
    }
    const validation = validateTaskDraft({ title, description, taskType, priority, requestedBy, executionMode, assigneeId, assigneeName });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const task = await createTaskDraft(
      { title, description, taskType, priority, requestedBy, executionMode, assigneeId, assigneeName },
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

  /**
   * GET /api/tasks/:id/pending-human-inputs
   * Returns all pending human inputs for a task's assignments.
   */
  app.get('/api/tasks/:id/pending-human-inputs', async (req, res) => {
    const taskId = req.params.id;
    const task = await store.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'task not found', taskId });
    }

    const assignments = await store.getTaskAssignmentsByTaskId(taskId);
    const allInputs = await store.getPendingHumanInputs();
    const relevantInputs = allInputs.filter(
      (input) => input.taskId === taskId && assignments.some((a) => a.id === input.assignmentId)
    );

    return res.json({ inputs: relevantInputs });
  });

  app.post('/api/assignments/:id/artifacts', async (req, res) => {
    const { type, title, content, structuredData, createdBy } = req.body;
    if (!type || !title || !content) {
      return res.status(400).json({ error: 'type, title and content are required' });
    }

    const artifact = {
      id: `art_${Date.now()}`,
      type,
      title,
      content,
      structuredData,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    const updated = await store.addArtifactToAssignment(req.params.id, artifact);
    if (!updated) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    return res.status(201).json(artifact);
  });

  /**
   * POST /api/assignments/:id/respond
   * Respond to a pending human input request and resume the assignment.
   */
  app.post('/api/assignments/:id/respond', async (req, res) => {
    const assignmentId = req.params.id;
    const { answer, answeredBy } = req.body;

    if (typeof answer !== 'string' || !answer.trim()) {
      return res.status(400).json({ error: 'answer is required and must be a non-empty string' });
    }

    // Find pending input for this assignment
    const pendingInputs = await store.getPendingHumanInputsByAssignmentId(assignmentId);
    const pendingInput = pendingInputs.find((p) => p.status === 'pending');

    if (!pendingInput) {
      return res.status(404).json({ error: 'No pending human input found for this assignment' });
    }

    // Update the pending input with the answer
    await store.updatePendingHumanInput(pendingInput.id, (current) => ({
      ...current,
      status: 'answered',
      answer: answer.trim(),
      answeredBy: typeof answeredBy === 'string' ? answeredBy : 'anonymous',
      answeredAt: new Date().toISOString(),
    }));

    // Resume the assignment - update status back to running
    await store.updateTaskAssignment(assignmentId, (current) => ({
      ...current,
      status: 'running',
      updatedAt: new Date().toISOString(),
    }));

    return res.status(200).json({
      success: true,
      pendingInputId: pendingInput.id,
      assignmentId,
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
