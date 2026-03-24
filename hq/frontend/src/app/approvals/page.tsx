'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useApprovals } from '../../hooks/useApprovals';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useTaskEventFeed } from '../../hooks/useTaskEventFeed';

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(227,212,196,0.45),transparent_24%),linear-gradient(180deg,#f7f2ea_0%,#f2eee7_100%)] px-6 py-8 text-slate-800">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">审批队列</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">审批列表</h1>
          </div>
          <Link href="/" className="rounded-full border border-[#ddd3c7] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[#b7a894] hover:text-slate-900">
            返回指挥台
          </Link>
        </div>

        <div className="rounded-[1.8rem] border border-[#d9d0c4] bg-[#fffdfa]/94 p-6">
          {loading && <p className="text-sm text-slate-600">正在加载审批队列…</p>}
          {error && (
            <div
              data-testid="approvals-error-state"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-400/30 bg-rose-500/10 p-4"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">审批队列加载失败</p>
                <p className="mt-2 text-sm text-rose-100">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void reload();
                }}
                disabled={loading}
                className="rounded-full border border-rose-300/50 bg-rose-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-100 transition-all hover:border-rose-300 hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
              >
                {loading ? '重试中...' : '重试加载'}
              </button>
            </div>
          )}
          {actionError && <p className="mb-4 text-sm text-rose-300">{actionError}</p>}
          {!loading && !error && actionApprovals.length === 0 && (
            <div
              data-testid="approvals-empty-state"
              className="mb-4 rounded-[1.2rem] border border-dashed border-white/15 bg-[#0d1118]/70 p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">审批队列为空</p>
              <p className="mt-2 text-sm text-slate-400">当前没有待处理审批。高风险任务触发审批后会显示在这里。</p>
              <button
                type="button"
                onClick={() => {
                  void reload();
                }}
                className="mt-3 rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 transition-all hover:border-white/25 hover:text-white"
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
                    className="rounded-full border border-[#ddd3c7] bg-white px-4 py-2 text-[10px] font-black tracking-[0.18em] text-slate-700 transition hover:border-[#b7a894] hover:text-slate-900 disabled:border-[#e5ddd2] disabled:text-slate-500"
                  >
                    {loading ? '刷新中…' : '刷新队列'}
                  </button>
                </div>
              </div>
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                {statusCardData.map((status) => (
                  <div
                    key={status.key}
                    className="rounded-2xl border border-[#e5ddd2] bg-[#f7f3ed] p-4"
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
                    className={`rounded-full border px-3 py-1 font-black uppercase tracking-[0.3em] transition ${
                      filterStatus === option.key
                        ? 'border-[#b8c9d2] bg-[#e9f0f3] text-slate-800'
                        : 'border-[#ddd3c7] text-slate-500 hover:border-[#b7a894] hover:text-slate-900'
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
                  className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-[#0d1118]/70 p-4"
                >
                  <p className="text-sm text-slate-600">当前筛选下没有匹配的审批记录。</p>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className="rounded-full border border-[#ddd3c7] px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-[#b7a894] hover:text-slate-900"
                  >
                    重置筛选
                  </button>
                </div>
              )}
              <div className="mb-6 rounded-2xl border border-[#e5ddd2] bg-[#f7f3ed] p-5">
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
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#ddd3c7] bg-white px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition hover:border-[#b7a894] hover:text-slate-900"
                  >
                    查看任务
                  </Link>
                )}
              </div>
            </>
          )}

          <div className="grid gap-4">
            {visibleApprovals.map((approval) => (
              <div key={approval.id} className="rounded-[1.4rem] border border-[#ddd3c7] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Link href={`/tasks/${approval.taskId}`} className="text-sm font-black text-slate-900 hover:text-slate-700">
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
                    <p className="text-sm font-black text-slate-900">{approval.status}</p>
                    <p className="mt-1 text-xs text-slate-500">{approval.requestedAt}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void approveApproval(approval.id)}
                    disabled={approval.status !== 'pending' || pendingId === approval.id}
                    className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100 transition-all hover:border-emerald-300 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                  >
                    批准
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectApproval(approval.id)}
                    disabled={approval.status !== 'pending' || pendingId === approval.id}
                    className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-100 transition-all hover:border-rose-300 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
