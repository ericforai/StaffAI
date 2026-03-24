'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useExecutionDetail } from '../../../hooks/useExecutionDetail';

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const executionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { execution, loading, error, notFound, reload } = useExecutionDetail(executionId);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_26%),#070b12] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300/80">Execution Detail</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white">执行详情</h1>
          </div>
          <Link href="/tasks" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:border-sky-400/40 hover:text-white">
            返回任务工作区
          </Link>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
          {loading && <p className="text-sm text-slate-400">正在加载执行详情...</p>}
          {error && (
            <div
              data-testid="execution-detail-error-state"
              className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-400/30 bg-rose-500/10 p-4"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">执行详情加载失败</p>
                <p className="mt-2 text-sm text-rose-100">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loading}
                className="rounded-full border border-rose-300/50 bg-rose-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-100 transition-all hover:border-rose-300 hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
              >
                {loading ? '重试中...' : '重试加载'}
              </button>
            </div>
          )}
          {!loading && !error && notFound && (
            <div
              data-testid="execution-detail-empty-state"
              className="rounded-[1.2rem] border border-dashed border-white/15 bg-[#0d1118]/70 p-5"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">执行记录不存在</p>
              <p className="mt-2 text-sm text-slate-400">这个执行记录可能已被清理，或者链接已经失效。你可以重试，或返回任务工作区继续排查。</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 transition-all hover:border-white/25 hover:text-white"
                >
                  重试加载
                </button>
                <Link
                  href="/tasks"
                  className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-100 transition-all hover:border-sky-300 hover:bg-sky-400/20"
                >
                  返回任务工作区
                </Link>
              </div>
            </div>
          )}

          {execution && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">状态</p>
                  <p className="mt-2 text-sm font-black text-white">{execution.status}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">执行器</p>
                  <p className="mt-2 text-sm font-black text-white">{execution.executor || 'unknown'}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Task ID</p>
                  <p className="mt-2 text-sm font-black text-white">{execution.taskId}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">开始时间</p>
                  <p className="mt-2 text-sm font-black text-white">{execution.startedAt || 'unknown'}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">完成时间</p>
                  <p className="mt-2 text-sm font-black text-white">{execution.completedAt || '尚未完成'}</p>
                </div>
              </div>
            </>
          )}

          {execution?.outputSummary && (
            <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">输出摘要</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{execution.outputSummary}</p>
            </div>
          )}

          {execution?.memoryContextExcerpt && (
            <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">执行上下文摘录</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {execution.memoryContextExcerpt}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
