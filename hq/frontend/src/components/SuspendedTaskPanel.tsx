'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Check, XCircle, Wrench, FileText, Play } from 'lucide-react';
import { apiClient } from '../lib/api-client';

interface TraceEvent {
  id: string;
  type: string;
  occurredAt: string;
  summary?: string;
}

interface ExecutionTracePayload {
  executions?: Array<{
    id: string;
    taskId: string;
    status: string;
  }>;
  error?: string;
}

interface ThoughtChainProps {
  taskId: string;
  className?: string;
}

export function SuspendedTaskPanel({ taskId, className = '' }: ThoughtChainProps) {
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadThoughtChain() {
      if (!taskId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload = await apiClient.get<ExecutionTracePayload>(
          `/executions?taskId=${taskId}&limit=10`, 
          { signal }
        );

        if (payload.executions && payload.executions.length > 0) {
          // 修复问题 12: 应该获取最新（最后一个）成功的执行记录，而不是第一个
          const executionsCopy = [...payload.executions];
          const latestCompleted = executionsCopy.reverse().find((e) => e.status === 'completed') ?? payload.executions[payload.executions.length - 1];
          const latestExecutionId = latestCompleted.id;
          
          const tracePayload = await apiClient.get<{ trace?: { traceEvents?: TraceEvent[] } }>(
            `/executions/${latestExecutionId}/trace`, 
            { signal }
          );

          const events = tracePayload.trace?.traceEvents || [];
          const thoughtEvents = events.filter((e) => e.type === 'thought' || e.type === 'execution_event');
          setTraceEvents(thoughtEvents.length > 0 ? thoughtEvents : events);
        } else {
          setTraceEvents([]);
        }
      } catch (requestError: any) {
        // 如果是 abort 导致的错误，则不显示在 UI 上
        if (requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : '加载思考链失败。');
      } finally {
        // 防止组件卸载后仍然设置状态
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadThoughtChain();

    return () => {
      controller.abort();
    };
  }, [taskId]);

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function getThoughtIcon(type: string) {
    switch (type) {
      case 'thought':
      case 'execution_event':
        return <Brain className="h-4 w-4 text-amber-600" />;
      case 'execution_started':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'execution_completed':
        return <Check className="h-4 w-4 text-emerald-600" />;
      case 'execution_failed':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'tool_call_logged':
        return <Wrench className="h-4 w-4 text-slate-600" />;
      default:
        return <FileText className="h-4 w-4 text-slate-500" />;
    }
  }

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="thought-chain-content"
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-amber-100/50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-amber-700" />
          <span className="text-sm font-bold text-amber-900">AI 思考过程</span>
          {traceEvents.length > 0 && !isExpanded && (
            <span className="text-xs text-amber-700">({traceEvents.length} 条记录)</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-amber-700" />
        ) : (
          <ChevronRight className="h-4 w-4 text-amber-700" />
        )}
      </button>

      {isExpanded && (
        <div id="thought-chain-content" className="border-t border-amber-200 bg-amber-50/50 px-4 py-3">
          {loading && <p className="text-sm text-amber-700">正在加载思考链…</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {!loading && !error && traceEvents.length === 0 && (
            <p className="text-sm text-amber-700">暂无思考记录。</p>
          )}
          {!loading && !error && traceEvents.length > 0 && (
            <div className="space-y-2">
              {traceEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <div className="flex items-start gap-2">
                    {getThoughtIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600">{formatTimestamp(event.occurredAt)}</span>
                      </div>
                      {event.summary && (
                        <p className="mt-1 text-sm text-slate-700 leading-relaxed">{event.summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
