import type { TaskEvent } from '../types';

export type TaskEventSummaryTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type TaskEventSurface = 'tasks' | 'approvals' | 'executions';

export interface TaskEventSummary {
  label: string;
  detail: string;
  tone: TaskEventSummaryTone;
  timestamp: string;
}

const TASK_EVENT_TYPE_SET: ReadonlySet<TaskEvent['taskEventType']> = new Set([
  'task_created',
  'approval_requested',
  'approval_resolved',
  'execution_started',
  'execution_completed',
  'execution_failed',
  'execution_degraded',
  'task_suspended',
  'task_resumed',
]);

const TASK_EVENT_METADATA: Record<TaskEvent['taskEventType'], { label: string; tone: TaskEventSummaryTone }> = {
  task_created: { label: '任务已创建', tone: 'info' },
  approval_requested: { label: '审批已发起', tone: 'warning' },
  approval_resolved: { label: '审批已处理', tone: 'info' },
  execution_started: { label: '执行开始', tone: 'info' },
  execution_completed: { label: '执行完成', tone: 'success' },
  execution_failed: { label: '执行失败', tone: 'danger' },
  execution_degraded: { label: '执行降级完成', tone: 'warning' },
  task_suspended: { label: '任务已暂停', tone: 'warning' },
  task_resumed: { label: '任务已恢复', tone: 'info' },
  execution_event: { label: 'AI 实时推导', tone: 'info' },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function hasStringField(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'string';
}

function isTaskEventType(value: unknown): value is TaskEvent['taskEventType'] {
  return typeof value === 'string' && TASK_EVENT_TYPE_SET.has(value as TaskEvent['taskEventType']);
}

export function isTaskEvent(value: unknown): value is TaskEvent {
  const record = asRecord(value);
  if (!record) {
    return false;
  }

  if (record.type !== 'TASK_EVENT') {
    return false;
  }

  if (!isTaskEventType(record.taskEventType)) {
    return false;
  }

  if (!hasStringField(record, 'message') || !hasStringField(record, 'timestamp')) {
    return false;
  }

  if (record.taskId !== undefined && typeof record.taskId !== 'string') {
    return false;
  }

  if (record.approvalId !== undefined && typeof record.approvalId !== 'string') {
    return false;
  }

  if (record.executionId !== undefined && typeof record.executionId !== 'string') {
    return false;
  }

  return true;
}

export function normalizeTaskEvents(input: unknown): TaskEvent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized: TaskEvent[] = [];
  for (const entry of input) {
    if (isTaskEvent(entry)) {
      normalized.push(entry);
    }
  }

  return normalized;
}

export function taskEventKey(event: TaskEvent) {
  return `${event.taskEventType}-${event.taskId || ''}-${event.approvalId || ''}-${event.executionId || ''}-${event.timestamp}`;
}

export function dedupeTaskEvents(events: readonly TaskEvent[]): TaskEvent[] {
  const seen = new Set<string>();
  const unique: TaskEvent[] = [];

  for (const event of events) {
    const key = taskEventKey(event);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(event);
  }

  return unique;
}

function parseTimestamp(timestamp: string) {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortTaskEventsByTimestampDesc(events: readonly TaskEvent[]): TaskEvent[] {
  return [...events].sort((left, right) => parseTimestamp(right.timestamp) - parseTimestamp(left.timestamp));
}

export function normalizeTaskEventFeed(input: unknown): TaskEvent[] {
  return sortTaskEventsByTimestampDesc(dedupeTaskEvents(normalizeTaskEvents(input)));
}

export function projectLatestTaskEventByTaskId(events: readonly TaskEvent[]): Map<string, TaskEvent> {
  const latest = new Map<string, TaskEvent>();

  for (const event of normalizeTaskEventFeed(events)) {
    if (!event.taskId || latest.has(event.taskId)) {
      continue;
    }
    latest.set(event.taskId, event);
  }

  return latest;
}

export function projectTaskEventSummary(event: TaskEvent): TaskEventSummary {
  const metadata = TASK_EVENT_METADATA[event.taskEventType];
  const detail = event.message.trim() || metadata.label;
  return {
    label: metadata.label,
    detail,
    tone: metadata.tone,
    timestamp: event.timestamp,
  };
}

export function projectLatestTaskEventSummaryByTaskId(events: readonly TaskEvent[]): Map<string, TaskEventSummary> {
  const latestSummaryByTaskId = new Map<string, TaskEventSummary>();
  for (const [taskId, event] of projectLatestTaskEventByTaskId(events)) {
    latestSummaryByTaskId.set(taskId, projectTaskEventSummary(event));
  }
  return latestSummaryByTaskId;
}

function eventMatchesSurface(event: TaskEvent, surface: TaskEventSurface) {
  if (surface === 'approvals') {
    return event.taskEventType === 'approval_requested' || event.taskEventType === 'approval_resolved';
  }

  if (surface === 'executions') {
    return (
      event.taskEventType === 'execution_started' ||
      event.taskEventType === 'execution_completed' ||
      event.taskEventType === 'execution_failed' ||
      event.taskEventType === 'execution_degraded'
    );
  }

  return true;
}

export function projectLatestSurfaceSummary(events: readonly TaskEvent[], surface: TaskEventSurface): TaskEventSummary | null {
  for (const event of normalizeTaskEventFeed(events)) {
    if (eventMatchesSurface(event, surface)) {
      return projectTaskEventSummary(event);
    }
  }

  return null;
}
