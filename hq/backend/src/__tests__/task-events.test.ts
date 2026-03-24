import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskEventPublisher, type TaskDashboardEvent } from '../observability/task-events';

test('task event publisher emits task and approval events with expected payloads', () => {
  const events: TaskDashboardEvent[] = [];
  const publisher = createTaskEventPublisher((event) => events.push(event));

  publisher.taskCreated({
    id: 'task-1',
    title: 'Create task',
    description: 'desc',
    status: 'created',
    executionMode: 'single',
    approvalRequired: false,
    riskLevel: 'low',
    recommendedAgentRole: 'software-architect',
    routingStatus: 'matched',
    createdAt: 'now',
    updatedAt: 'now',
  });

  publisher.approvalRequested({
    id: 'approval-1',
    taskId: 'task-1',
    status: 'pending',
    requestedBy: 'system',
    requestedAt: 'now',
  });

  publisher.approvalResolved({
    id: 'approval-1',
    taskId: 'task-1',
    status: 'approved',
    requestedBy: 'system',
    requestedAt: 'now',
    resolvedAt: 'later',
  });

  assert.equal(events.length, 3);
  assert.equal(events[0]?.taskEventType, 'task_created');
  assert.equal(events[1]?.taskEventType, 'approval_requested');
  assert.equal(events[2]?.taskEventType, 'approval_resolved');
});

test('task event publisher maps execution statuses to completion events', () => {
  const events: TaskDashboardEvent[] = [];
  const publisher = createTaskEventPublisher((event) => events.push(event));

  publisher.executionStarted({ taskId: 'task-1', executor: 'codex' });
  publisher.executionFinished({ id: 'exec-1', taskId: 'task-1', status: 'completed' });
  publisher.executionFinished({ id: 'exec-2', taskId: 'task-1', status: 'failed' });
  publisher.executionFinished({ id: 'exec-3', taskId: 'task-1', status: 'degraded' });

  assert.deepEqual(
    events.map((event) => event.taskEventType),
    ['execution_started', 'execution_completed', 'execution_failed', 'execution_degraded']
  );
});
