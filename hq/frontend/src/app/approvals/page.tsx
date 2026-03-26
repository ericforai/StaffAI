'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApprovals } from '../../hooks/useApprovals';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useTaskEventFeed } from '../../hooks/useTaskEventFeed';
import { useWebSocket } from '../../hooks/useWebSocket';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const formatApprovalDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

export default function ApprovalsPage() {
  const { approvals, loading, error, reload } = useApprovals();
  const { latestSummaryByTaskId } = useTaskEventFeed();
  const {
    approvals: actionApprovals,
    pendingId,
    error: actionError,
    approveApproval,
    rejectApproval,
  } = useApprovalActions(approvals);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const { status: wsStatus } = useWebSocket({ onMessage: () => {} });

  const totalApprovals = actionApprovals.length;
  const nextPendingApproval = actionApprovals.find((approval) => approval.status === 'pending');
  const formattedNextRequestedAt = formatApprovalDate(nextPendingApproval?.requestedAt);
  const statusCounts = actionApprovals.reduce<Record<string, number>>(
    (acc, approval) => {
      acc[approval.status] = (acc[approval.status] ?? 0) + 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 },
  );
  const statusCardData = [
    { key: 'pending', label: '待处理', note: '需要决策', accent: 'text-emerald-700' },
    { key: 'approved', label: '已批准', note: '可继续执行', accent: 'text-sky-700' },
    { key: 'rejected', label: '已拒绝', note: '需要重新评估', accent: 'text-rose-700' },
  ];
  const filterOptions: Array<{ key: FilterStatus; label: string }> = [
    { key: 'all', label: '全部状态' },
    { key: 'pending', label: '只看待处理' },
    { key: 'approved', label: '只看已批准' },
    { key: 'rejected', label: '只看已拒绝' },
  ];
  const visibleApprovals = useMemo(
    () =>
      filterStatus === 'all'
        ? actionApprovals
        : actionApprovals.filter((approval) => approval.status === filterStatus),
    [actionApprovals, filterStatus],
  );

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
            <Link href="/tasks" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              工作任务
            </Link>
            <Link href="/approvals" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm pl-10">
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
            <h2 className="text-sm font-bold text-slate-900">审批列表</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">高风险任务审批决策中心</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px]">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              {loading && <p className="text-sm text-slate-600">正在加载审批队列…</p>}
              {error && (
                <div
                  data-testid="approvals-error-state"
                  className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">审批队列加载失败</p>
                    <p className="mt-2 text-sm text-rose-600">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void reload();
                    }}
                    disabled={loading}
                    className="rounded-lg border border-rose-300 bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-600 transition-all hover:border-rose-400 hover:bg-rose-200 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {loading ? '重试中...' : '重试加载'}
                  </button>
                </div>
              )}
              {actionError && <p className="mb-4 text-sm text-rose-500">{actionError}</p>}
              {!loading && !error && actionApprovals.length === 0 && (
                <div
                  data-testid="approvals-empty-state"
                  className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">审批队列为空</p>
                  <p className="mt-2 text-sm text-slate-500">当前没有待处理审批。高风险任务触发审批后会显示在这里。</p>
                  <button
                    type="button"
                    onClick={() => {
                      void reload();
                    }}
                    className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
                  >
                    刷新队列
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">审批概览</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">队列快照</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold tracking-[0.16em] text-slate-500">共 {totalApprovals} 条审批</p>
                      <button
                        type="button"
                        onClick={() => {
                          void reload();
                        }}
                        disabled={loading}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-black tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:text-slate-400"
                      >
                        {loading ? '刷新中…' : '刷新队列'}
                      </button>
                    </div>
                  </div>
                  <div className="mb-6 grid gap-4 md:grid-cols-3">
                    {statusCardData.map((status) => (
                      <div
                        key={status.key}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">{status.label}</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{statusCounts[status.key] ?? 0}</p>
                        <p className={`mt-1 text-xs font-semibold ${status.accent}`}>{status.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {filterOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setFilterStatus(option.key)}
                        className={`rounded-lg border px-3 py-1 font-black uppercase tracking-[0.3em] transition ${
                          filterStatus === option.key
                            ? 'border-slate-400 bg-slate-100 text-slate-800'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] tracking-[0.18em] text-slate-500">
                      当前显示 {visibleApprovals.length} / {totalApprovals}
                    </span>
                  </div>
                  {visibleApprovals.length === 0 && actionApprovals.length > 0 && (
                    <div
                      data-testid="approvals-filter-empty-state"
                      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-sm text-slate-500">当前筛选下没有匹配的审批记录。</p>
                      <button
                        type="button"
                        onClick={() => setFilterStatus('all')}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
                      >
                        重置筛选
                      </button>
                    </div>
                  )}
                  <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">下一条待处理审批</p>
                      <p className="text-xs text-slate-500">建议优先处理</p>
                    </div>
                    <p className="mt-3 text-xl font-black text-slate-900">
                      {nextPendingApproval ? nextPendingApproval.taskId : '当前没有待处理审批'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {nextPendingApproval
                        ? `${nextPendingApproval.requestedBy} 发起${formattedNextRequestedAt ? ` · ${formattedNextRequestedAt}` : ''}`
                        : '当前队列已经处理完毕。'}
                    </p>
                    {nextPendingApproval && latestSummaryByTaskId.get(nextPendingApproval.taskId) && (
                      <p className="mt-2 text-xs text-slate-500">
                        任务最新事件：{latestSummaryByTaskId.get(nextPendingApproval.taskId)?.detail}
                      </p>
                    )}
                    {nextPendingApproval && (
                      <Link
                        href={`/tasks/${nextPendingApproval.taskId}`}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        查看任务
                      </Link>
                    )}
                  </div>
                </>
              )}

              <div className="grid gap-4">
                {visibleApprovals.map((approval) => (
                  <div key={approval.id} className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Link href={`/tasks/${approval.taskId}`} className="text-sm font-bold text-slate-900 hover:text-slate-700">
                          {approval.taskId}
                        </Link>
                        <p className="mt-2 text-xs tracking-[0.14em] text-slate-500">{approval.requestedBy}</p>
                        {latestSummaryByTaskId.get(approval.taskId) && (
                          <p className="mt-2 text-xs text-slate-500">
                            最新事件：{latestSummaryByTaskId.get(approval.taskId)?.detail}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{approval.status}</p>
                        <p className="mt-1 text-xs text-slate-500">{approval.requestedAt}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => void approveApproval(approval.id)}
                        disabled={approval.status !== 'pending' || pendingId === approval.id}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700 transition-all hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        批准
                      </button>
                      <button
                        type="button"
                        onClick={() => void rejectApproval(approval.id)}
                        disabled={approval.status !== 'pending' || pendingId === approval.id}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-700 transition-all hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
