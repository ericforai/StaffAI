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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(190,214,227,0.5),transparent_28%),linear-gradient(180deg,#f7f2ea_0%,#f2eee7_100%)] px-6 py-8 text-slate-800">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">任务工作区</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">任务列表</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">这里展示任务主线和最新状态，方便你连续处理，不需要在多个页面之间来回切换。</p>
          </div>
          <Link href="/" className="rounded-full border border-[#ddd3c7] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[#b7a894] hover:text-slate-900">
            返回指挥台
          </Link>
        </div>

        <div className="mb-4 rounded-[1.8rem] border border-[#d9d0c4] bg-[#fffdfa]/94 p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">新建任务</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">发起新任务</h2>
            </div>
            <p className="text-xs tracking-[0.18em] text-slate-500">任务入口</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="任务标题"
              className="rounded-[1rem] border border-[#ddd3c7] bg-white px-4 py-3 text-base text-slate-800 outline-none ring-0 placeholder:text-slate-400"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="任务描述"
              className="rounded-[1rem] border border-[#ddd3c7] bg-white px-4 py-3 text-base text-slate-800 outline-none ring-0 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => void createTask()}
              disabled={submitting}
              className="rounded-full border border-[#b8c9d2] bg-[#e9f0f3] px-5 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#9ab0bc] hover:bg-[#dce8ee] disabled:cursor-not-allowed disabled:border-[#e5ddd2] disabled:bg-[#f3eee7] disabled:text-slate-500"
            >
              {submitting ? '创建中…' : '创建任务'}
            </button>
          </div>

          {composeError && <p className="mt-3 text-sm text-rose-300">{composeError}</p>}
        </div>

        <div className="rounded-[1.8rem] border border-[#d9d0c4] bg-[#fffdfa]/94 p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                viewMode === 'all'
                  ? 'border-[#b7a894] bg-[#f1ebe2] text-slate-900'
                  : 'border-[#ddd3c7] text-slate-500 hover:border-[#b7a894] hover:text-slate-900'
              }`}
            >
              全部任务
            </button>
            <button
              type="button"
              onClick={() => setViewMode('active')}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                viewMode === 'active'
                  ? 'border-[#b8c9d2] bg-[#e9f0f3] text-slate-800'
                  : 'border-[#ddd3c7] text-slate-500 hover:border-[#b7a894] hover:text-slate-900'
              }`}
            >
              待执行
            </button>
            <p className="text-xs text-slate-400">
              显示 {visibleTasks.length} / {tasks.length} 条任务
            </p>
          </div>

          {loading && <p className="text-sm text-slate-600">正在加载任务…</p>}
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
              className="mb-4 rounded-[1.2rem] border border-dashed border-[#ddd3c7] bg-[#f7f3ed] p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">暂无任务</p>
              <p className="mt-2 text-sm text-slate-400">还没有任务，先在上方创建第一条任务，或返回指挥台从专家讨论生成任务。</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="rounded-full border border-[#ddd3c7] px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-[#b7a894] hover:text-slate-900"
                >
                  刷新任务
                </button>
                <Link
                  href="/"
                  className="rounded-full border border-[#b8c9d2] bg-[#e9f0f3] px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-800 transition-all hover:border-[#9ab0bc] hover:bg-[#dce8ee]"
                >
                  前往指挥台
                </Link>
              </div>
            </div>
          )}
          {!loading && !error && tasks.length > 0 && visibleTasks.length === 0 && (
            <div
              data-testid="tasks-filter-empty-state"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-[#ddd3c7] bg-[#f7f3ed] p-4"
            >
              <p className="text-sm text-slate-400">
                当前筛选没有可执行任务，切换回 <span className="font-black text-white">全部任务</span> 查看其他项。
              </p>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                  className="rounded-full border border-[#ddd3c7] px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-[#b7a894] hover:text-slate-900"
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
                  className="rounded-[1.5rem] border border-[#ddd3c7] bg-white px-5 py-5 transition-all hover:border-[#b7a894] hover:bg-[#faf7f2]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{task.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
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
