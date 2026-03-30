'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useExecutionDetail } from '../../../hooks/useExecutionDetail';
import { useExecutionTrace } from '../../../hooks/useExecutionTrace';
import type { ToolCallSummary } from '../../../types';
import { API_CONFIG } from '../../../utils/constants';
import { formatTimestamp } from '../../../utils/dateFormatter';
import ReactMarkdown from 'react-markdown';

function formatToolCallStatus(status: string) {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'running':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '已阻断';
    case 'skipped':
      return '已跳过';
    default:
      return status;
  }
}

function formatExecutionStatus(status: string) {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'running':
      return '执行中';
    case 'completed':
    case 'succeeded':
      return '已完成';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    case 'paused':
      return '已暂停';
    default:
      return status;
  }
}

import { formatExecutor, formatRiskLevel } from '../../../utils/formatters';

function formatControlStatus(status: string) {
  switch (status) {
    case 'paused':
      return '已暂停';
    case 'resumed':
      return '已恢复';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
}

function formatExecutionDisplayId(execution: { displayExecutionId?: string; id: string }) {
  if (execution.displayExecutionId && execution.displayExecutionId.trim()) {
    return execution.displayExecutionId;
  }
  return execution.id;
}

function normalizeToolCalls(execution: ReturnType<typeof useExecutionDetail>['execution']) {
  if (!execution) {
    return [];
  }

  if (Array.isArray(execution.toolCalls)) {
    return execution.toolCalls;
  }

  return [];
}

function formatTraceEventType(type: string) {
  switch (type) {
    case 'execution_started':
      return '开始执行';
    case 'execution_completed':
      return '执行完成';
    case 'execution_failed':
      return '执行失败';
    case 'execution_cancelled':
      return '执行取消';
    case 'execution_degraded':
      return '降级执行';
    case 'cost_observed':
      return '成本统计';
    default:
      return type;
  }
}

function formatTraceEventSummary(type: string, summary?: string) {
  if (!summary) {
    return undefined;
  }

  // 处理旧的英文格式 - Execution started/failed/completed/cancelled/degraded
  if (summary.startsWith('Execution started:')) {
    // "开始执行" 类型已经说明了，不需要额外显示
    return undefined;
  }
  if (summary.startsWith('Execution ')) {
    const match = /^Execution\s+(\w+):\s+(.+)$/.exec(summary);
    if (match) {
      const [, status, id] = match;
      // 如果是 UUID，不显示；否则显示状态信息
      if (/^[0-9a-f-]{36}$/i.test(id)) {
        return undefined;
      }
    }
  }

  // 处理成本统计
  if (type === 'cost_observed' && summary.startsWith('Cost observed:')) {
    const match = /Cost observed:\s*(\d+)\s*tokens/.exec(summary);
    if (match) {
      return `本次消耗：${match[1]} tokens`;
    }
  }

  // 对于工具调用完成/失败，如果有工具名称，显示出来
  if (type === 'tool_call_logged') {
    if (summary.startsWith('工具调用完成：') || summary.startsWith('工具调用失败：')) {
      return summary;
    }
  }

  // 对于开始/完成类事件，如果摘要只是重复类型信息，不显示
  if (type === 'execution_started' || type === 'execution_completed' ||
      type === 'execution_failed' || type === 'execution_cancelled') {
    // 如果摘要只是"开始执行任务：xxx"或"完成任务：xxx"，类型已经说明了
    if (summary.startsWith('开始执行任务：') || summary.startsWith('完成任务：') ||
        summary.startsWith('失败任务：') || summary.startsWith('取消任务：')) {
      return undefined;
    }
  }

  // 其他情况直接返回 summary
  return summary;
}

function formatTraceOccurredAt(occurredAt: string) {
  const absolute = formatTimestamp(occurredAt);
  const timestamp = new Date(occurredAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return absolute;
  }

  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 0) {
    return absolute;
  }

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes <= 0) {
    return `${absolute}（刚刚）`;
  }
  if (minutes < 60) {
    return `${absolute}（${minutes}分钟前）`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${absolute}（${hours}小时前）`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return `${absolute}（昨天）`;
  }

  return absolute;
}

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const executionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { execution, loading, error, notFound, reload } = useExecutionDetail(executionId);
  const { trace, loading: traceLoading, error: traceError, reload: reloadTrace } = useExecutionTrace(executionId);
  const toolCalls = normalizeToolCalls(execution);

  async function postControl(action: 'pause' | 'resume' | 'cancel') {
    if (!executionId) return;
    await fetch(`${API_CONFIG.BASE_URL}/executions/${executionId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agency-Control': '1' },
    });
    await reload();
    await reloadTrace();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(190,214,227,0.5),transparent_26%),linear-gradient(180deg,#f7f2ea_0%,#f2eee7_100%)] px-6 py-8 text-slate-800">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">执行详情</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">执行详情</h1>
          </div>
          <Link href="/tasks" className="rounded-full border border-[#ddd3c7] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[#b7a894] hover:text-slate-900">
            返回任务工作区
          </Link>
        </div>

        <div data-testid="execution-detail-root" className="rounded-[1.8rem] border border-[#d9d0c4] bg-[#fffdfa]/94 p-6">
          {loading && <p className="text-sm text-slate-600">正在加载执行详情…</p>}
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
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">执行编号</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{formatExecutionDisplayId(execution)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">状态</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{formatExecutionStatus(execution.status)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">执行器</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{formatExecutor(execution.executor)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">任务编号</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.taskId}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">开始时间</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{formatTimestamp(execution.startedAt)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">完成时间</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.completedAt ? formatTimestamp(execution.completedAt) : '尚未完成'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  data-testid="execution-pause-button"
                  onClick={() => void postControl('pause')}
                  className="rounded-full border border-[#ddd3c7] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-700 hover:border-[#b7a894] hover:text-slate-900"
                >
                  暂停
                </button>
                <button
                  type="button"
                  data-testid="execution-resume-button"
                  onClick={() => void postControl('resume')}
                  className="rounded-full border border-[#b8c9d2] bg-[#e9f0f3] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-800 hover:border-[#9ab0bc] hover:bg-[#dce8ee]"
                >
                  恢复
                </button>
                <button
                  type="button"
                  data-testid="execution-cancel-button"
                  onClick={() => void postControl('cancel')}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                >
                  取消
                </button>
                {execution.controlState?.status && (
                  <p className="self-center text-xs text-slate-500">
                    控制状态：<span className="font-black text-slate-800">{formatControlStatus(execution.controlState.status)}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {execution?.outputSummary && (
            <div className="mt-4 rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">输出摘要</p>
              <div className="mt-2 text-sm leading-7 text-slate-700 prose prose-slate max-w-none">
                <ReactMarkdown>{execution.outputSummary}</ReactMarkdown>
              </div>
            </div>
          )}

          {execution?.errorMessage && (
            <div className="mt-4 rounded-[1.2rem] border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">失败原因</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-rose-50">{execution.errorMessage}</p>
            </div>
          )}

          {toolCalls.length > 0 && (
            <div data-testid="execution-toolcalls" className="mt-4 rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">工具调用</p>
              <div className="mt-4 space-y-3">
                {toolCalls.map((toolCall: ToolCallSummary) => (
                  <div key={toolCall.id} data-testid={`toolcall-card-${toolCall.id}`} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfaf5] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{toolCall.toolName}</p>
                        <p className="mt-1 text-xs tracking-[0.16em] text-slate-500">
                          {toolCall.actorRole || '未知角色'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">{formatToolCallStatus(toolCall.status)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{formatRiskLevel(toolCall.riskLevel)}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1rem] border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black tracking-[0.16em] text-slate-500">输入摘要</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {toolCall.inputSummary || '暂无输入摘要'}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black tracking-[0.16em] text-slate-500">输出摘要</p>
                        <div className="mt-2 text-sm leading-6 text-slate-700 prose prose-slate max-w-none">
                          {toolCall.outputSummary ? <ReactMarkdown>{toolCall.outputSummary}</ReactMarkdown> : '暂无输出摘要'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] tracking-[0.16em] text-slate-500">
                      {(toolCall.timestamp || toolCall.createdAt) && <span>{formatTimestamp(toolCall.timestamp || toolCall.createdAt)}</span>}
                      {toolCall.id && <span>ID: {toolCall.id}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">执行流程记录</p>
              <button
                type="button"
                data-testid="execution-trace-reload"
                onClick={() => void reloadTrace()}
                className="rounded-full border border-[#ddd3c7] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:border-[#b7a894] hover:text-slate-900"
              >
                刷新
              </button>
            </div>
            {traceLoading && <p className="mt-2 text-sm text-slate-600">正在加载流程记录…</p>}
            {traceError && <p className="mt-2 text-sm text-rose-600">{traceError}</p>}
            {!traceLoading && !traceError && (trace?.traceEvents?.length ?? 0) === 0 && (
              <p className="mt-2 text-sm text-slate-500">暂无流程记录。</p>
            )}
            {(trace?.traceEvents?.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-2" data-testid="execution-trace-events">
                {trace?.traceEvents?.slice(0, 20).map((event) => {
                  const summaryText = formatTraceEventSummary(event.type, event.summary);
                  return (
                    <li key={event.id} className="rounded-[0.9rem] border border-[#eee6db] bg-[#fffdfa] p-3">
                      <p className="text-xs font-black text-slate-800">{formatTraceEventType(event.type)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatTraceOccurredAt(event.occurredAt)}</p>
                      {summaryText ? <p className="mt-2 text-sm text-slate-700">{summaryText}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
