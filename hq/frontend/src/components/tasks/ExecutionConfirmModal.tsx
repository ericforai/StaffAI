'use client';

import Link from 'next/link';

interface ExecutionConfirmModalProps {
  taskId: string;
  executing: boolean;
  onClose: () => void;
  onExecute: (taskId: string) => void;
}

export function ExecutionConfirmModal({
  taskId,
  executing,
  onClose,
  onExecute
}: ExecutionConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">任务创建成功！</h3>
          <p className="mt-2 text-sm text-slate-600">任务已添加到队列，你可以立即执行或稍后在详情页启动。</p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            稍后执行
          </button>
          <button
            type="button"
            onClick={() => onExecute(taskId)}
            disabled={executing}
            className="flex-1 rounded-lg border border-sky-500 bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executing ? '执行中...' : '立即执行'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link
            href={`/tasks/${taskId}`}
            onClick={onClose}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            查看任务详情
          </Link>
        </div>
      </div>
    </div>
  );
}
