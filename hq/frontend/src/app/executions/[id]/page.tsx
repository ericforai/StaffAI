'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useExecutionDetail } from '../../../hooks/useExecutionDetail';
import { useExecutionTrace } from '../../../hooks/useExecutionTrace';
import type { ToolCallSummary } from '../../../types';
import { API_CONFIG } from '../../../utils/constants';

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

function formatRiskLevel(riskLevel?: string) {
  if (!riskLevel) {
    return '未标注';
  }

  switch (riskLevel) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中风险';
    case 'high':
      return '高风险';
    default:
      return riskLevel;
  }
}

function normalizeToolCalls(execution: ReturnType<typeof useExecutionDetail>['execution']) {
  if (!execution) {
    return [];
  }

  const candidates = [execution.toolCalls, execution.toolCallLogs, execution.toolCallLog];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
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
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">状态</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.status}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">执行器</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.executor || '未知'}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">任务编号</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.taskId}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">开始时间</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.startedAt || '未知'}</p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">完成时间</p>
                  <p className="mt-2 text-sm font-black text-slate-900">{execution.completedAt || '尚未完成'}</p>
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
                    控制状态：<span className="font-black text-slate-800">{execution.controlState.status}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {execution?.outputSummary && (
            <div className="mt-4 rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">输出摘要</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{execution.outputSummary}</p>
            </div>
          )}

          {execution?.errorMessage && (
            <div className="mt-4 rounded-[1.2rem] border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">失败原因</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-rose-50">{execution.errorMessage}</p>
            </div>
          )}

          {execution?.memoryContextExcerpt && (
            <div className="mt-4 rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">执行上下文摘录</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {execution.memoryContextExcerpt}
              </p>
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
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {toolCall.outputSummary || '暂无输出摘要'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] tracking-[0.16em] text-slate-500">
                      {(toolCall.timestamp || toolCall.createdAt) && <span>{toolCall.timestamp || toolCall.createdAt}</span>}
                      {toolCall.id && <span>ID: {toolCall.id}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-[1.2rem] border border-[#ddd3c7] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">执行轨迹</p>
              <button
                type="button"
                data-testid="execution-trace-reload"
                onClick={() => void reloadTrace()}
                className="rounded-full border border-[#ddd3c7] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:border-[#b7a894] hover:text-slate-900"
              >
                刷新
              </button>
            </div>
            {traceLoading && <p className="mt-2 text-sm text-slate-600">正在加载执行轨迹…</p>}
            {traceError && <p className="mt-2 text-sm text-rose-600">{traceError}</p>}
            {!traceLoading && !traceError && (trace?.traceEvents?.length ?? 0) === 0 && (
              <p className="mt-2 text-sm text-slate-500">暂无轨迹事件。</p>
            )}
            {(trace?.traceEvents?.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-2" data-testid="execution-trace-events">
                {trace?.traceEvents?.slice(0, 20).map((event) => (
                  <li key={event.id} className="rounded-[0.9rem] border border-[#eee6db] bg-[#fffdfa] p-3">
                    <p className="text-xs font-black text-slate-800">{event.type}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.occurredAt}</p>
                    {event.summary ? <p className="mt-2 text-sm text-slate-700">{event.summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
