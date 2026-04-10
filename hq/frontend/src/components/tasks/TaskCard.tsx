'use client';

import Link from 'next/link';
import { Pin } from 'lucide-react';
import { formatTaskStatus, formatExecutionMode } from '../../utils/formatters';
import type { TaskSummary } from '../../types';

interface TaskCardProps {
  task: TaskSummary;
  latestSummary?: { detail: string };
  pinnedTaskId?: string;
  onPinToggle?: (taskId: string) => void;
}

export function TaskCard({ task, latestSummary, pinnedTaskId, onPinToggle }: TaskCardProps) {
  const isPinned = pinnedTaskId === task.id;

  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-400">
      <Link
        href={`/tasks/${task.id}`}
        className="min-w-0 flex-1 px-5 py-4 hover:bg-slate-50"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {task.assigneeName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                  {task.assigneeName}
                </span>
              )}
              {latestSummary && (
                <span className="text-xs text-slate-500">
                  最新事件：{latestSummary.detail}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs uppercase tracking-[0.2em] text-slate-500">
            <p>{formatTaskStatus(task.status)}</p>
            <p className="mt-2">{formatExecutionMode(task.executionMode)}</p>
          </div>
        </div>
      </Link>
      {onPinToggle ? (
        <div className="flex w-[4.5rem] shrink-0 flex-col justify-center border-l border-slate-100 bg-slate-50/80">
          <button
            type="button"
            data-testid={`task-pin-${task.id}`}
            onClick={() => onPinToggle(task.id)}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-3 text-[10px] font-black uppercase tracking-tight transition ${
              isPinned
                ? 'bg-violet-100 text-violet-800'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title={isPinned ? '取消固定到交付主线' : '固定到交付主线'}
          >
            <Pin size={16} className={isPinned ? 'fill-violet-700 text-violet-700' : ''} strokeWidth={2} />
            {isPinned ? '已固定' : '固定'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
