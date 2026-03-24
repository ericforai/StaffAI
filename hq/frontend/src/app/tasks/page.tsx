'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTasks } from '../../hooks/useTasks';
import { useTaskComposer } from '../../hooks/useTaskComposer';
import { useTaskEventFeed } from '../../hooks/useTaskEventFeed';

export default function TasksPage() {
  const { tasks, loading, error, setTasks, reload } = useTasks();
  const { latestSummaryByTaskId } = useTaskEventFeed();
  const { title, setTitle, description, setDescription, submitting, error: composeError, createTask } = useTaskComposer((task) =>
    setTasks((current) => [task, ...current])
  );
  const [viewMode, setViewMode] = useState<'all' | 'active'>('all');

  const actionableTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'waiting_approval'),
    [tasks],
  );
  const visibleTasks = viewMode === 'active' ? actionableTasks : tasks;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(28,117,188,0.16),transparent_28%),#070b12] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300/80">Task Workspace</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white">任务列表</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">这里展示平台 1.0 的任务主线。后续会继续接入更完整的执行、审批和 read model。</p>
          </div>
          <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:border-cyan-400/40 hover:text-white">
            返回指挥台
          </Link>
        </div>

        <div className="mb-4 rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/70">Create Task</p>
              <h2 className="mt-2 text-2xl font-black text-white">发起新任务</h2>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">workspace command</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="任务标题"
              className="rounded-[1rem] border border-white/10 bg-[#0d1118]/85 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="任务描述"
              className="rounded-[1rem] border border-white/10 bg-[#0d1118]/85 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => void createTask()}
              disabled={submitting}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100 transition-all hover:border-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
            >
              {submitting ? '创建中...' : '创建任务'}
            </button>
          </div>

          {composeError && <p className="mt-3 text-sm text-rose-300">{composeError}</p>}
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                viewMode === 'all'
                  ? 'border-white/40 bg-white/[0.08] text-white'
                  : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
              }`}
            >
              全部任务
            </button>
            <button
              type="button"
              onClick={() => setViewMode('active')}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                viewMode === 'active'
                  ? 'border-sky-400/60 bg-sky-400/10 text-sky-200'
                  : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
              }`}
            >
              待执行
            </button>
            <p className="text-xs text-slate-400">
              显示 {visibleTasks.length} / {tasks.length} 条任务
            </p>
          </div>

          {loading && <p className="text-sm text-slate-400">正在加载任务...</p>}
          {error && (
            <div
              data-testid="tasks-error-state"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-400/30 bg-rose-500/10 p-4"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">任务加载失败</p>
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
          {!loading && !error && tasks.length === 0 && (
            <div
              data-testid="tasks-empty-state"
              className="mb-4 rounded-[1.2rem] border border-dashed border-white/15 bg-[#0d1118]/70 p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">暂无任务</p>
              <p className="mt-2 text-sm text-slate-400">还没有任务，先在上方创建第一条任务，或返回指挥台从专家讨论生成任务。</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 transition-all hover:border-white/25 hover:text-white"
                >
                  刷新任务
                </button>
                <Link
                  href="/"
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100 transition-all hover:border-cyan-300 hover:bg-cyan-400/20"
                >
                  前往指挥台
                </Link>
              </div>
            </div>
          )}
          {!loading && !error && tasks.length > 0 && visibleTasks.length === 0 && (
            <div
              data-testid="tasks-filter-empty-state"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-[#0d1118]/70 p-4"
            >
              <p className="text-sm text-slate-400">
                当前筛选没有可执行任务，切换回 <span className="font-black text-white">全部任务</span> 查看其他项。
              </p>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 transition-all hover:border-white/25 hover:text-white"
              >
                查看全部
              </button>
            </div>
          )}

          <div className="grid gap-4">
            {visibleTasks.map((task) => {
              const latestSummary = latestSummaryByTaskId.get(task.id);
              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="rounded-[1.5rem] border border-white/10 bg-[#0d1118]/85 px-5 py-5 transition-all hover:border-cyan-400/30 hover:bg-cyan-400/5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-white">{task.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">{task.description}</p>
                      {latestSummary && (
                        <p aria-hidden="true" className="mt-2 text-xs text-slate-500">
                          最新事件：{latestSummary.detail}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.2em] text-slate-500">
                      <p>{task.status}</p>
                      <p className="mt-2">{task.executionMode}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
