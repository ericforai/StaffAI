'use client';

import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { OutputSection } from './OutputSection';
import { 
  formatTimestamp 
} from '../../utils/dateFormatter';
import { 
  formatExecutor, 
  formatTraceEventType,
  formatExecutionStatus
} from '../../utils/formatters';
import { parseOutputSummary } from '../../lib/execution-parser';
import type { TaskExecution, ExecutionTrace } from '../../types';

interface ExecutionListProps {
  executions: TaskExecution[];
  expandedExecutionId: string | null;
  setExpandedExecutionId: (id: string | null) => void;
  copiedExecutionId: string | null;
  copyOutputSummary: (id: string, content: string) => void;
  trace: ExecutionTrace | null;
  traceLoading: boolean;
  traceError: string | null;
  reloadTrace: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  submitting: boolean;
}

function formatExecutionDisplayId(execution: { displayExecutionId?: string; id: string; startedAt?: string }) {
  if (execution.displayExecutionId && execution.displayExecutionId.trim()) {
    return execution.displayExecutionId;
  }
  const date = execution.startedAt ? new Date(execution.startedAt).toISOString().slice(0, 10).replace(/-/g, '') : '000000';
  const shortId = execution.id.slice(0, 8);
  return `${date}—${shortId}`;
}

function formatTraceEventSummary(type: string, summary?: string) {
  if (!summary) return undefined;
  if (summary.startsWith('Execution started:')) return undefined;
  if (summary.startsWith('Execution ')) {
    const match = /^Execution\s+(\w+):\s+(.+)$/.exec(summary);
    if (match && /^[0-9a-f-]{36}$/i.test(match[2])) return undefined;
  }
  if (type === 'cost_observed' && summary.startsWith('Cost observed:')) {
    const match = /Cost observed:\s*(\d+)\s*tokens/.exec(summary);
    if (match) return `本次消耗：${match[1]} tokens`;
  }
  return summary;
}

export function ExecutionList({
  executions,
  expandedExecutionId,
  setExpandedExecutionId,
  copiedExecutionId,
  copyOutputSummary,
  trace,
  traceLoading,
  traceError,
  reloadTrace,
  onPause,
  onResume,
  onCancel,
  submitting
}: ExecutionListProps) {
  return (
    <div className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] tracking-[0.2em] text-slate-500">执行记录</p>
      <div className="mt-4 space-y-2">
        {executions.length === 0 && <p className="text-sm text-slate-500">当前没有执行记录。</p>}
        {executions.map((execution, index) => {
          const isLatest = index === 0;
          const isExpanded = expandedExecutionId === execution.id;
          return (
            <div key={execution.id} className={`rounded-[1.1rem] border overflow-hidden ${isExpanded ? 'border-slate-300 bg-white' : 'border-slate-200 bg-[#fcfaf5]'}`}>
              <button
                type="button"
                onClick={() => setExpandedExecutionId(isExpanded ? null : execution.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isLatest && <span className="text-[10px] text-slate-400">最新</span>}
                  <span className="text-[10px] font-black tracking-[0.12em] text-slate-500">
                    {formatExecutionDisplayId(execution)}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-[0.16em] ${
                    execution.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    execution.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {formatExecutionStatus(execution.status)}
                  </span>
                  <span className="text-xs text-slate-500">{formatTimestamp(execution.startedAt)}</span>
                  {execution.executor && <span className="text-xs text-slate-500">{formatExecutor(execution.executor)}</span>}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-3 space-y-4">
                  {/* Memory Context */}
                  {execution.memoryContextExcerpt && (
                    <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">记忆上下文</p>
                        <span className="text-[10px] font-medium text-slate-400">L1/L2 加载数据</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{execution.memoryContextExcerpt}</p>
                    </div>
                  )}

                  {/* 输出摘要 */}
                  {execution.outputSummary && (
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] tracking-[0.16em] text-slate-500">输出摘要</p>
                        <button
                          type="button"
                          onClick={() => copyOutputSummary(execution.id, execution.outputSummary ?? '')}
                          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        >
                          {copiedExecutionId === execution.id ? (
                            <><Check className="h-3.5 w-3.5 text-emerald-600" /><span className="text-emerald-600">已复制</span></>
                          ) : (
                            <><Copy className="h-3.5 w-3.5" /><span>复制</span></>
                          )}
                        </button>
                      </div>
                      <div className="mt-2 space-y-3">
                        {(() => {
                          const { sections } = parseOutputSummary(execution.outputSummary);
                          return sections.map((section) => (
                            <OutputSection
                              key={section.title}
                              title={section.title}
                              icon={section.icon}
                              content={section.content}
                              level={section.level}
                            />
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* 错误信息 */}
                  {execution.errorMessage && (
                    <div className="rounded-[1rem] border border-rose-200 bg-rose-50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-rose-400">失败原因</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-rose-700">{execution.errorMessage}</p>
                    </div>
                  )}

                  {/* 执行流程记录 */}
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] tracking-[0.16em] text-slate-500">执行流程记录</p>
                      <button
                        type="button"
                        onClick={reloadTrace}
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black tracking-[0.2em] text-slate-600 hover:border-slate-300 hover:text-slate-950"
                      >
                        刷新
                      </button>
                    </div>
                    {traceLoading && <p className="mt-2 text-sm text-slate-600">正在加载流程记录…</p>}
                    {traceError && <p className="mt-2 text-sm text-rose-600">{traceError}</p>}
                    {trace?.traceEvents && trace.traceEvents.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {trace.traceEvents.slice(0, 20).map((event) => (
                          <li key={event.id} className="rounded-[0.8rem] border border-slate-200 bg-white p-2">
                            <p className="text-xs font-black text-slate-800">{formatTraceEventType(event.type)}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{formatTimestamp(event.occurredAt)}</p>
                            {formatTraceEventSummary(event.type, event.summary) && (
                              <p className="mt-1 text-xs text-slate-700">{formatTraceEventSummary(event.type, event.summary)}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* 控制按钮 */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onPause(execution.id)}
                      disabled={submitting}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                    >
                      暂停
                    </button>
                    <button
                      type="button"
                      onClick={() => onResume(execution.id)}
                      disabled={submitting}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancel(execution.id)}
                      disabled={submitting}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-rose-600 hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
