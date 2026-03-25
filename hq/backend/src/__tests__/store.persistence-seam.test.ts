import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApprovalRepository, ExecutionRepository, TaskAssignmentRepository, TaskRepository, ToolCallLogRepository, WorkflowPlanRepository } from '../persistence/file-repositories';
import type { ApprovalRecord, ExecutionRecord, TaskAssignment, TaskRecord, ToolCallLog, WorkflowPlan } from '../shared/task-types';
import { Store } from '../store';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Sample task',
    description: 'Sample description',
    taskType: 'general',
    priority: 'medium',
    status: 'routed',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    requestedBy: 'system',
    requestedAt: '2026-03-24T00:00:00.000Z',
    recommendedAgentRole: 'software-architect',
    candidateAgentRoles: ['software-architect'],
    routeReason: 'matched by default',
    routingStatus: 'matched',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

function makeApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: 'approval-1',
    taskId: 'task-1',
    status: 'pending',
    requestedBy: 'system',
    requestedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

function makeExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: 'execution-1',
    taskId: 'task-1',
    status: 'pending',
    executor: 'codex',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id: 'assignment-1',
    taskId: 'task-1',
    agentId: 'software-architect',
    assignmentRole: 'primary',
    status: 'pending',
    ...overrides,
  };
}

function makeWorkflowPlan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    id: 'plan-1',
    taskId: 'task-1',
    mode: 'single',
    synthesisRequired: false,
    steps: [
      {
        id: 'step-1',
        title: 'Draft architecture proposal',
        assignmentId: 'assignment-1',
        agentId: 'software-architect',
        assignmentRole: 'primary',
        status: 'pending',
      },
    ],
    ...overrides,
  };
}

function makeToolCallLog(overrides: Partial<ToolCallLog> = {}): ToolCallLog {
  return {
    id: 'tool-call-log-1',
    toolId: 'read-file',
    toolName: 'Read File',
    actorRole: 'software-architect',
    riskLevel: 'low',
    taskId: 'task-1',
    executionId: 'execution-1',
    status: 'pending',
    inputSummary: '{"path":"README.md"}',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

test('store delegates task/approval/execution operations through injected repositories', async () => {
  const tasks: TaskRecord[] = [];
  const approvals: ApprovalRecord[] = [];
  const executions: ExecutionRecord[] = [];
  const assignments: TaskAssignment[] = [];
  const workflowPlans: WorkflowPlan[] = [];
  const toolCallLogs: ToolCallLog[] = [];
  const taskRepository: TaskRepository = {
    list: async () => [...tasks],
    getById: async (id) => tasks.find((task) => task.id === id) || null,
    save: async (task) => {
      tasks.push(task);
    },
    update: async (id, updater) => {
      const index = tasks.findIndex((task) => task.id === id);
      if (index < 0) return null;
      tasks[index] = updater(tasks[index]);
      return tasks[index];
    },
  };

  const approvalRepository: ApprovalRepository = {
    list: async () => [...approvals],
    listByTaskId: async (taskId) => approvals.filter((approval) => approval.taskId === taskId),
    save: async (approval) => {
      approvals.push(approval);
    },
    updateStatus: async (approvalId, status) => {
      const index = approvals.findIndex((approval) => approval.id === approvalId);
      if (index < 0) return null;
      approvals[index] = {
        ...approvals[index],
        status,
        resolvedAt: new Date().toISOString(),
      };
      return approvals[index];
    },
  };

  const executionRepository: ExecutionRepository = {
    list: async () => [...executions],
    getById: async (id) => executions.find((execution) => execution.id === id) || null,
    listByTaskId: async (taskId) => executions.filter((execution) => execution.taskId === taskId),
    save: async (execution) => {
      executions.push(execution);
    },
    update: async (id, updater) => {
      const index = executions.findIndex((execution) => execution.id === id);
      if (index < 0) return null;
      executions[index] = updater(executions[index]);
      return executions[index];
    },
  };

  const taskAssignmentRepository: TaskAssignmentRepository = {
    list: async () => [...assignments],
    getById: async (id) => assignments.find((assignment) => assignment.id === id) || null,
    listByTaskId: async (taskId) => assignments.filter((assignment) => assignment.taskId === taskId),
    save: async (assignment) => {
      assignments.push(assignment);
    },
    update: async (id, updater) => {
      const index = assignments.findIndex((assignment) => assignment.id === id);
      if (index < 0) return null;
      assignments[index] = updater(assignments[index]);
      return assignments[index];
    },
  };

  const workflowPlanRepository: WorkflowPlanRepository = {
    list: async () => [...workflowPlans],
    getByTaskId: async (taskId) => workflowPlans.find((plan) => plan.taskId === taskId) || null,
    save: async (plan) => {
      workflowPlans.push(plan);
    },
    update: async (taskId, updater) => {
      const index = workflowPlans.findIndex((plan) => plan.taskId === taskId);
      if (index < 0) return null;
      workflowPlans[index] = updater(workflowPlans[index]);
      return workflowPlans[index];
    },
  };

  const toolCallLogRepository: ToolCallLogRepository = {
    list: async () => [...toolCallLogs],
    getById: async (id) => toolCallLogs.find((toolCallLog) => toolCallLog.id === id) || null,
    listByTaskId: async (taskId) => toolCallLogs.filter((toolCallLog) => toolCallLog.taskId === taskId),
    listByExecutionId: async (executionId) =>
      toolCallLogs.filter((toolCallLog) => toolCallLog.executionId === executionId),
    save: async (toolCallLog) => {
      toolCallLogs.push(toolCallLog);
    },
    update: async (id, updater) => {
      const index = toolCallLogs.findIndex((toolCallLog) => toolCallLog.id === id);
      if (index < 0) return null;
      toolCallLogs[index] = updater(toolCallLogs[index]);
      return toolCallLogs[index];
    },
  };

  const store = new Store({
    taskRepository,
    approvalRepository,
    executionRepository,
    taskAssignmentRepository,
    workflowPlanRepository,
    toolCallLogRepository,
  });

  await store.saveTask(makeTask());
  await store.saveApproval(makeApproval());
  await store.saveExecution(makeExecution());
  await store.saveTaskAssignment(makeAssignment());
  await store.saveWorkflowPlan(makeWorkflowPlan());
  await store.saveToolCallLog(makeToolCallLog());

  assert.equal((await store.getTasks()).length, 1);
  assert.equal((await store.getApprovals()).length, 1);
  assert.equal((await store.getExecutions()).length, 1);
  assert.equal((await store.getTaskAssignmentsByTaskId('task-1')).length, 1);
  assert.equal((await store.getWorkflowPlanByTaskId('task-1'))?.id, 'plan-1');
  assert.equal((await store.getToolCallLogsByTaskId('task-1')).length, 1);
  assert.equal((await store.getToolCallLogsByExecutionId('execution-1')).length, 1);
  assert.equal((await store.getTaskById('task-1'))?.id, 'task-1');
  assert.equal((await store.getExecutionById('execution-1'))?.id, 'execution-1');
  assert.equal((await store.getApprovalsByTaskId('task-1')).length, 1);
  assert.equal((await store.getExecutionsByTaskId('task-1')).length, 1);

  const updatedTask = await store.updateTask('task-1', (task) => ({ ...task, status: 'completed' }));
  const updatedApproval = await store.updateApprovalStatus('approval-1', 'approved');
  const updatedExecution = await store.updateExecution('execution-1', (execution) => ({
    ...execution,
    status: 'completed',
    outputSummary: 'done',
  }));
  const updatedAssignment = await store.updateTaskAssignment('assignment-1', (assignment) => ({
    ...assignment,
    status: 'completed',
    resultSummary: 'done',
  }));
  const updatedWorkflowPlan = await store.updateWorkflowPlan('task-1', (plan) => ({
    ...plan,
    synthesisRequired: true,
  }));
  const updatedToolCallLog = await store.updateToolCallLog('tool-call-log-1', (toolCallLog) => ({
    ...toolCallLog,
    status: 'completed',
    output: '{"ok":true}',
  }));

  assert.equal(updatedTask?.status, 'completed');
  assert.equal(updatedApproval?.status, 'approved');
  assert.equal(updatedExecution?.status, 'completed');
  assert.equal(updatedAssignment?.status, 'completed');
  assert.equal(updatedWorkflowPlan?.synthesisRequired, true);
  assert.equal(updatedToolCallLog?.status, 'completed');
});
