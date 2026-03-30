'use client';

import Link from 'next/link';
import { formatTaskStatus, formatExecutionMode } from '../../utils/formatters';
import type { TaskSummary } from '../../types';

interface TaskCardProps {
  task: TaskSummary;
  latestSummary?: { detail: string };
}

export function TaskCard({ task, latestSummary }: TaskCardProps) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="rounded-lg border border-slate-200 bg-white px-5 py-4 transition-all hover:border-slate-400 hover:bg-slate-50"
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
        <div className="text-right text-xs uppercase tracking-[0.2em] text-slate-500">
          <p>{formatTaskStatus(task.status)}</p>
          <p className="mt-2">{formatExecutionMode(task.executionMode)}</p>
        </div>
      </div>
    </Link>
  );
}
