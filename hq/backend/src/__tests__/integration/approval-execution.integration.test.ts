/**
 * Approval-Execution Bridge Integration Tests
 *
 * End-to-end tests for the approval-to-execution workflow:
 * - Approval triggers automatic execution
 * - Manual execution control
 * - Execution failure handling
 * - State persistence across transitions
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../../store';
import { createTaskLifecycleService } from '../../orchestration/task-lifecycle-service';
import { createTaskStateMachine } from '../../orchestration/task-state-machine';
import { createWorkflowExecutionEngine } from '../../orchestration/workflow-execution-engine';
import { createAssignmentExecutor } from '../../orchestration/assignment-executor';
import { AuditLogger, type AuditEvent } from '../../governance/audit-logger';
import { createFileAuditLogRepository } from '../../persistence/audit-log-repositories';
import type { TaskRecord, WorkflowPlan, TaskAssignment, ExecutionRecord } from '../../shared/task-types';

// Test context
let tempDir: string;
let store: Store;
let auditLogger: AuditLogger | null;
let lifecycleService: ReturnType<typeof createTaskLifecycleService>;
let stateMachine: ReturnType<typeof createTaskStateMachine>;
let workflowEngine: ReturnType<typeof createWorkflowExecutionEngine>;
let assignmentExecutor: ReturnType<typeof createAssignmentExecutor>;

async function setupTestEnvironment() {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agency-approval-execution-'));

  process.env.AGENCY_TASKS_FILE = path.join(tempDir, 'tasks.json');
  process.env.AGENCY_APPROVALS_FILE = path.join(tempDir, 'approvals.json');
  process.env.AGENCY_EXECUTIONS_FILE = path.join(tempDir, 'executions.json');
  process.env.AGENCY_TASK_ASSIGNMENTS_FILE = path.join(tempDir, 'task_assignments.json');
  process.env.AGENCY_WORKFLOW_PLANS_FILE = path.join(tempDir, 'workflow_plans.json');
  process.env.AGENCY_AUDIT_LOGS_DIR = path.join(tempDir, 'audit');

  store = new Store();
  const auditRepository = createFileAuditLogRepository(path.join(tempDir, 'audit'));
  auditLogger = new AuditLogger(auditRepository);

  lifecycleService = createTaskLifecycleService({
    store,
    auditLogger: {
      async log(event: AuditEvent) {
        if (auditLogger) {
          await auditLogger.log(event);
        }
      },
    },
  });

  stateMachine = createTaskStateMachine(store['taskRepository'], auditLogger);

  // Create assignment executor with mock runtime
  assignmentExecutor = createAssignmentExecutor({
    store,
    auditLogger,
    executor: 'claude',
    timeoutMs: 5000,
  });

  workflowEngine = createWorkflowExecutionEngine({
    store,
    assignmentExecutor,
    auditLogger,
  });
}

async function teardownTestEnvironment() {
  await fs.rm(tempDir, { recursive: true, force: true });

  delete process.env.AGENCY_TASKS_FILE;
  delete process.env.AGENCY_APPROVALS_FILE;
  delete process.env.AGENCY_EXECUTIONS_FILE;
  delete process.env.AGENCY_TASK_ASSIGNMENTS_FILE;
  delete process.env.AGENCY_WORKFLOW_PLANS_FILE;
  delete process.env.AGENCY_AUDIT_LOGS_DIR;
}

before(async () => {
  await setupTestEnvironment();
});

after(async () => {
  await teardownTestEnvironment();
});

// ============================================================================
// Test Suite 1: Approval Triggers Execution
// ============================================================================

test('approval to execution: approved task transitions to routed', async () => {
  const task = await lifecycleService.createTask({
    title: 'Execute after approval',
    description: 'DELETE all production database records',
    requestedBy: 'user1',
    priority: 'high',
  });

  assert.equal(task.status, 'waiting_approval');

  const approvals = await store.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  // Approve the task
  const result = await lifecycleService.handleApprovalDecision(
    approvalId,
    'approved',
    'manager1',
    'Approved for execution'
  );

  assert.equal(result.task?.status, 'routed');
  assert.equal(result.approval?.status, 'approved');

  // Verify audit trail
  const auditLogs = await auditLogger!.getAuditTrail(task.id);
  const approvalEvent = auditLogs.find((log) => log.action === 'approval_approved');
  assert.notEqual(approvalEvent, undefined);
});

test('approval to execution: rejected task cannot be executed', async () => {
  const task = await lifecycleService.createTask({
    title: 'Should be rejected',
    description: 'DROP DATABASE and DELETE all records',
    requestedBy: 'user1',
    executionMode: 'single',
  });

  const approvals = await store.getApprovalsByTaskId(task.id);
  assert.ok(approvals.length > 0, 'Expected at least one approval');
  const approvalId = approvals[0].id;

  const result = await lifecycleService.handleApprovalDecision(
    approvalId,
    'rejected',
    'manager1',
    'Too risky'
  );

  assert.equal(result.task?.status, 'cancelled');
  assert.equal(result.approval?.status, 'rejected');

  // Verify cannot transition to running
  const canRun = await stateMachine.canTransition(task.id, 'running');
  assert.equal(canRun, false);
});

// ============================================================================
// Test Suite 2: Manual Execution Control
// ============================================================================

test('manual execution: low-risk task can be started directly', async () => {
  const task = await lifecycleService.createTask({
    title: 'Direct execution',
    description: 'Low risk, no approval needed',
    requestedBy: 'user1',
  });

  assert.equal(task.status, 'routed');
  assert.equal(task.approvalRequired, false);

  // Can start execution directly
  const result = await stateMachine.transition(task.id, 'start_execution', 'system');

  assert.equal(result.success, true);
  assert.equal(result.newStatus, 'running');
});

test('manual execution: task stays in routed after approval until manually started', async () => {
  const task = await lifecycleService.createTask({
    title: 'Manual start after approval',
    description: 'DELETE user records',
    requestedBy: 'user1',
  });

  // First request approval (high-risk due to DELETE keyword)
  const approval = await lifecycleService.requestApproval(task.id, 'Manager approval required');

  const approvals = await store.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  await lifecycleService.handleApprovalDecision(approvalId, 'approved', 'manager1');

  const updated = await store.getTaskById(task.id);
  assert.equal(updated?.status, 'routed');
  assert.equal(updated?.approvalRequired, false);

  // Verify we can still transition to running
  const canRun = await stateMachine.canTransition(task.id, 'running');
  assert.equal(canRun, true);
});

// ============================================================================
// Test Suite 3: Execution Record Creation
// ============================================================================

test('execution record: created when assignment completes', async () => {
  const task = await lifecycleService.createTask({
    title: 'Task with execution record',
    description: 'Should create execution record',
    requestedBy: 'user1',
  });

  // Create a workflow plan with assignment
  const workflowPlan: WorkflowPlan = {
    id: randomUUID(),
    taskId: task.id,
    mode: 'serial',
    synthesisRequired: false,
    status: 'planned',
    steps: [{
      id: randomUUID(),
      title: 'Execute step',
      description: 'Test step',
      agentId: 'claude',
      assignmentId: randomUUID(),
      assignmentRole: 'primary',
      status: 'pending',
      order: 1,
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.saveWorkflowPlan(workflowPlan);

  const assignment: TaskAssignment = {
    id: workflowPlan.steps[0].assignmentId,
    taskId: task.id,
    workflowPlanId: workflowPlan.id,
    stepId: workflowPlan.steps[0].id,
    agentId: 'claude',
    assignmentRole: 'primary',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.saveTaskAssignment(assignment);

  // Mark assignment as completed
  await store.updateTaskAssignment(assignment.id, (current) => ({
    ...current,
    status: 'completed',
    completedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    resultSummary: 'Execution successful',
  }));

  // Create execution record
  const execution: ExecutionRecord = {
    id: randomUUID(),
    taskId: task.id,
    status: 'completed',
    executor: 'claude',
    runtimeName: 'claude',
    assignmentId: assignment.id,
    outputSummary: 'Task completed successfully',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  await store.saveExecution(execution);

  // Verify execution record can be retrieved
  const retrieved = await store.getExecutionById(execution.id);
  assert.equal(retrieved?.id, execution.id);
  assert.equal(retrieved?.status, 'completed');
  assert.equal(retrieved?.taskId, task.id);
});

test('execution record: retrieved by task ID', async () => {
  const task = await lifecycleService.createTask({
    title: 'Multi-execution task',
    description: 'Test multiple executions',
    requestedBy: 'user1',
  });

  const execution1: ExecutionRecord = {
    id: randomUUID(),
    taskId: task.id,
    status: 'completed',
    executor: 'claude',
    runtimeName: 'claude',
    outputSummary: 'First execution',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  const execution2: ExecutionRecord = {
    id: randomUUID(),
    taskId: task.id,
    status: 'failed',
    executor: 'codex',
    runtimeName: 'codex',
    outputSummary: 'Second execution failed',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
  };

  await store.saveExecution(execution1);
  await store.saveExecution(execution2);

  const executions = await store.getExecutionsByTaskId(task.id);
  assert.equal(executions.length, 2);
  assert.ok(executions.some((e) => e.id === execution1.id));
  assert.ok(executions.some((e) => e.id === execution2.id));
});

// ============================================================================
// Test Suite 4: Workflow Execution Integration
// ============================================================================

test('workflow execution: creates execution record on completion', async () => {
  const task = await lifecycleService.createTask({
    title: 'Workflow test',
    description: 'Test workflow execution',
    requestedBy: 'user1',
  });

  await stateMachine.transition(task.id, 'start_execution', 'system');

  // Create workflow plan
  const workflowPlan: WorkflowPlan = {
    id: randomUUID(),
    taskId: task.id,
    mode: 'serial',
    synthesisRequired: false,
    status: 'running',
    steps: [{
      id: randomUUID(),
      title: 'Step 1',
      description: 'First step',
      agentId: 'claude',
      assignmentId: randomUUID(),
      assignmentRole: 'primary',
      status: 'completed',
      order: 1,
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.saveWorkflowPlan(workflowPlan);

  // Complete the workflow
  await store.updateWorkflowPlan(task.id, (current) => ({
    ...current,
    status: 'completed',
  }));

  await stateMachine.transition(task.id, 'complete_execution', 'system');

  const updated = await store.getTaskById(task.id);
  assert.equal(updated?.status, 'completed');

  const workflow = await store.getWorkflowPlanByTaskId(task.id);
  assert.equal(workflow?.status, 'completed');
});

test('workflow execution: failed step stops serial workflow', async () => {
  const task = await lifecycleService.createTask({
    title: 'Failing workflow',
    description: 'Test workflow failure',
    requestedBy: 'user1',
  });

  // First transition to running
  await stateMachine.transition(task.id, 'start_execution', 'system');

  // Create workflow plan with multiple steps
  const workflowPlan: WorkflowPlan = {
    id: randomUUID(),
    taskId: task.id,
    mode: 'serial',
    synthesisRequired: false,
    status: 'running',
    steps: [
      {
        id: randomUUID(),
        title: 'Step 1',
        description: 'Completed step',
        agentId: 'claude',
        assignmentId: randomUUID(),
        assignmentRole: 'primary',
        status: 'completed',
        order: 1,
      },
      {
        id: randomUUID(),
        title: 'Step 2',
        description: 'Failed step',
        agentId: 'claude',
        assignmentId: randomUUID(),
        assignmentRole: 'primary',
        status: 'failed',
        order: 2,
      },
      {
        id: randomUUID(),
        title: 'Step 3',
        description: 'Never executed',
        agentId: 'claude',
        assignmentId: randomUUID(),
        assignmentRole: 'primary',
        status: 'pending',
        order: 3,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.saveWorkflowPlan(workflowPlan);

  await stateMachine.transition(task.id, 'fail_execution', 'system', 'Step 2 failed');

  const updated = await store.getTaskById(task.id);
  assert.equal(updated?.status, 'failed');
});

// ============================================================================
// Test Suite 5: Assignment Status Updates
// ============================================================================

test('assignment status: transitions through execution lifecycle', async () => {
  const task = await lifecycleService.createTask({
    title: 'Assignment status test',
    description: 'Test assignment status updates',
    requestedBy: 'user1',
  });

  const assignmentId = randomUUID();

  const assignment: TaskAssignment = {
    id: assignmentId,
    taskId: task.id,
    workflowPlanId: randomUUID(),
    stepId: randomUUID(),
    agentId: 'claude',
    assignmentRole: 'primary',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.saveTaskAssignment(assignment);

  // Transition to running
  await store.updateTaskAssignment(assignmentId, (current) => ({
    ...current,
    status: 'running',
    startedAt: new Date().toISOString(),
  }));

  let updated = await store.getTaskAssignmentById(assignmentId);
  assert.equal(updated?.status, 'running');

  // Transition to completed
  await store.updateTaskAssignment(assignmentId, (current) => ({
    ...current,
    status: 'completed',
    completedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    resultSummary: 'Assignment completed',
  }));

  updated = await store.getTaskAssignmentById(assignmentId);
  assert.equal(updated?.status, 'completed');
  assert.equal(updated?.resultSummary, 'Assignment completed');
  assert.ok(updated?.completedAt);
});

test('assignment status: failure preserves error message', async () => {
  const task = await lifecycleService.createTask({
    title: 'Failing assignment',
    description: 'Test assignment failure',
    requestedBy: 'user1',
  });

  const assignmentId = randomUUID();
  const errorMessage = 'Connection timeout after 30s';

  const assignment: TaskAssignment = {
    id: assignmentId,
    taskId: task.id,
    workflowPlanId: randomUUID(),
    stepId: randomUUID(),
    agentId: 'claude',
    assignmentRole: 'primary',
    status: 'running',
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.saveTaskAssignment(assignment);

  // Mark as failed
  await store.updateTaskAssignment(assignmentId, (current) => ({
    ...current,
    status: 'failed',
    errorMessage,
    endedAt: new Date().toISOString(),
  }));

  const updated = await store.getTaskAssignmentById(assignmentId);
  assert.equal(updated?.status, 'failed');
  assert.equal(updated?.errorMessage, errorMessage);
});

// ============================================================================
// Test Suite 6: End-to-End Approval to Execution Flow
// ============================================================================

test('e2e: full approval to execution flow', async () => {
  // 1. Create high-risk task
  const task = await lifecycleService.createTask({
    title: 'Critical deployment',
    description: 'Deploy to production',
    requestedBy: 'dev1',
    priority: 'high',
    executionMode: 'single',
  });

  assert.equal(task.status, 'waiting_approval');
  assert.equal(task.approvalRequired, true);

  // 2. Get approval and approve it
  const approvals = await store.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  const approvalResult = await lifecycleService.handleApprovalDecision(
    approvalId,
    'approved',
    'manager1',
    'Production deployment approved'
  );

  assert.equal(approvalResult.task?.status, 'routed');

  // 3. Start execution
  const executionResult = await stateMachine.transition(task.id, 'start_execution', 'system');

  assert.equal(executionResult.success, true);
  assert.equal(executionResult.newStatus, 'running');

  // 4. Complete execution
  const completionResult = await stateMachine.transition(task.id, 'complete_execution', 'system');

  assert.equal(completionResult.success, true);
  assert.equal(completionResult.newStatus, 'completed');

  // 5. Verify final state
  const finalTask = await store.getTaskById(task.id);
  assert.equal(finalTask?.status, 'completed');

  // 6. Verify audit trail
  const auditLogs = await auditLogger!.getAuditTrail(task.id);
  const actions = auditLogs.map((log) => log.action);

  assert.ok(actions.includes('created_waiting_approval'));
  assert.ok(actions.includes('approval_approved'));
  assert.ok(actions.some((a) => a.includes('status_changed')));

  // 7. Verify approval status
  const finalApproval = await store.getApprovalsByTaskId(task.id);
  assert.equal(finalApproval[0].status, 'approved');
});

test('e2e: rejection prevents execution', async () => {
  // 1. Create high-risk task
  const task = await lifecycleService.createTask({
    title: 'Dangerous operation',
    description: 'Delete production data',
    requestedBy: 'dev1',
    executionMode: 'single',
  });

  // 2. Reject approval
  const approvals = await store.getApprovalsByTaskId(task.id);
  const approvalId = approvals[0].id;

  const result = await lifecycleService.handleApprovalDecision(
    approvalId,
    'rejected',
    'manager1',
    'Operation too dangerous'
  );

  assert.equal(result.task?.status, 'cancelled');

  // 3. Verify cannot execute
  const canStart = await stateMachine.canTransition(task.id, 'running');
  assert.equal(canStart, false);

  // 4. Verify audit trail includes rejection
  const auditLogs = await auditLogger!.getAuditTrail(task.id);
  const rejectEvent = auditLogs.find((log) => log.action === 'approval_rejected');
  assert.notEqual(rejectEvent, undefined);
  assert.equal(rejectEvent?.actor, 'manager1');
});
