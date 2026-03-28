/**
 * Shared formatting functions for the Agency HQ frontend.
 * Extracted from page components to reduce duplication.
 */

import type { WorkflowPlanMode } from '../types';

export function formatTaskStatus(status: string): string {
  switch (status) {
    case 'created':
      return '待执行';
    case 'waiting_approval':
      return '等待审批';
    case 'completed':
      return '已完成';
    case 'running':
      return '执行中';
    case 'failed':
      return '执行失败';
    case 'cancelled':
      return '已取消';
    case 'pending':
      return '待开始';
    default:
      return status;
  }
}

export function formatExecutionMode(executionMode: string): string {
  switch (executionMode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    case 'advanced_discussion':
      return '高级讨论';
    case 'auto':
      return '自动';
    default:
      return executionMode;
  }
}

export function formatWorkflowPlanMode(mode: WorkflowPlanMode): string {
  switch (mode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

export function formatWorkflowStepStatus(status?: string): string {
  if (!status) {
    return '待确认';
  }

  switch (status) {
    case 'pending':
      return '待处理';
    case 'running':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'skipped':
      return '已跳过';
    default:
      return status;
  }
}

export function formatApprovalStatus(status: string): string {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'approved':
      return '已批准';
    case 'rejected':
      return '已拒绝';
    default:
      return status;
  }
}

export function formatExecutionStatus(status?: string): string {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return '成功';
    case 'running':
      return '执行中';
    case 'failed':
      return '失败';
    case 'pending':
      return '待执行';
    default:
      return status || '暂无执行';
  }
}

export interface TaskStatusMessage {
  tone: string;
  title: string;
  body: string;
}

export function getTaskStatusMessage(status: string, executionMode: string): TaskStatusMessage {
  if (status === 'waiting_approval') {
    return {
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
      title: '任务等待审批',
      body: '这个任务被识别为高风险动作，必须先在审批队列中通过后才能继续执行。',
    };
  }

  if (status === 'completed') {
    return {
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      title: '任务已完成',
      body: '当前任务已经执行完成，可以继续查看执行摘要或沿着相关审批/结果继续追踪。',
    };
  }

  if (executionMode === 'advanced_discussion') {
    return {
      tone: 'border-sky-200 bg-sky-50 text-sky-800',
      title: '高级讨论模式',
      body: '这个任务会走多专家讨论与综合路径，而不是普通单任务执行。',
    };
  }

  return {
    tone: 'border-slate-200 bg-white text-slate-700',
    title: '可直接执行',
    body: '当前任务处于可执行状态，可以直接在这里触发执行并查看 execution 结果。',
  };
}
