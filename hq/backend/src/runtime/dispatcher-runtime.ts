import type { TaskExecutionMode, TaskRecord } from '../shared/task-types';

export interface DispatcherDirective {
  actorRole: 'dispatcher';
  requestedMode: TaskExecutionMode;
  appliedMode: TaskExecutionMode;
  reason: string;
  actions: string[];
}

export function buildDispatcherDirective(input: {
  task: TaskRecord;
  requestedMode: TaskExecutionMode;
  appliedMode: TaskExecutionMode;
  degraded: boolean;
}): DispatcherDirective {
  const { task, requestedMode, appliedMode, degraded } = input;
  const actions: string[] = [];

  if (requestedMode !== appliedMode) {
    actions.push(`switch_mode:${requestedMode}->${appliedMode}`);
  }
  if (degraded) {
    actions.push('degrade_execution');
  }
  if (appliedMode === 'serial' || appliedMode === 'parallel') {
    actions.push('synthesize_multi_step_results');
  }
  actions.push(`route_owner:${task.recommendedAgentRole}`);

  return {
    actorRole: 'dispatcher',
    requestedMode,
    appliedMode,
    reason: degraded
      ? 'Runtime capability or policy required fallback handling.'
      : 'Dispatcher coordinates execution flow and final synthesis.',
    actions,
  };
}
