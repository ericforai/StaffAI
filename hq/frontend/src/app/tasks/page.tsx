'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTasks } from '../../hooks/useTasks';
import { useTaskComposer } from '../../hooks/useTaskComposer';
import { useTaskEventFeed } from '../../hooks/useTaskEventFeed';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function TasksPage() {
  const { tasks, loading, error, setTasks, reload } = useTasks();
  const { latestSummaryByTaskId } = useTaskEventFeed();
  const { title, setTitle, description, setDescription, submitting, error: composeError, createTask } = useTaskComposer((task) =>
    setTasks((current) => [task, ...current])
  );
  const [viewMode, setViewMode] = useState<'all' | 'active'>('all');
  const { status: wsStatus } = useWebSocket({ onMessage: () => {} });

  const actionableTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'waiting_approval'),
    [tasks],
  );
  const visibleTasks = viewMode === 'active' ? actionableTasks : tasks;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AI员工</span>
            <span>管理中心</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">管理系统</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            总览
          </Link>
          <Link href="/market" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            人才市场
          </Link>
          <Link href="/organization" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            组织架构
          </Link>
          <div className="space-y-1">
            <Link href="/tasks" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm">
              工作任务
            </Link>
            <Link href="/approvals" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium pl-10 text-slate-600 hover:bg-slate-50">
              审批列表
            </Link>
          </div>
          <Link href="/brainstorm" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            专家协作
          </Link>
          <Link href="/knowledge" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            知识资产
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">系统状态</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {wsStatus === 'connected' ? '已连接' : '同步中...'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">工作任务</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">统一承接执行入口、审批链路与任务态势</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px]">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
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
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
                />
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="任务描述"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => void createTask()}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {submitting ? '创建中…' : '创建任务'}
                </button>
              </div>

              {composeError && <p className="mt-3 text-sm text-rose-500">{composeError}</p>}
            </div>

            <div className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                    viewMode === 'all'
                      ? 'border-slate-400 bg-slate-100 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  全部任务
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('active')}
                  className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                    viewMode === 'active'
                      ? 'border-slate-400 bg-slate-100 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
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
                  className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">任务加载失败</p>
                    <p className="mt-2 text-sm text-rose-600">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    disabled={loading}
                    className="rounded-lg border border-rose-300 bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-600 transition-all hover:border-rose-400 hover:bg-rose-200 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {loading ? '重试中...' : '重试加载'}
                  </button>
                </div>
              )}
              {!loading && !error && tasks.length === 0 && (
                <div
                  data-testid="tasks-empty-state"
                  className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">暂无任务</p>
                  <p className="mt-2 text-sm text-slate-500">还没有任务，先在上方创建第一条任务，或返回指挥台从专家讨论生成任务。</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void reload()}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
                    >
                      刷新任务
                    </button>
                    <Link
                      href="/"
                      className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200"
                    >
                      前往指挥台
                    </Link>
                  </div>
                </div>
              )}
              {!loading && !error && tasks.length > 0 && visibleTasks.length === 0 && (
                <div
                  data-testid="tasks-filter-empty-state"
                  className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm text-slate-500">
                    当前筛选没有可执行任务，切换回 <span className="font-black text-slate-900">全部任务</span> 查看其他项。
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
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
                      className="rounded-lg border border-slate-200 bg-white px-5 py-4 transition-all hover:border-slate-400 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                          {latestSummary && (
                            <p className="mt-2 text-xs text-slate-500">
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
        </div>
      </main>
    </div>
  );
}
