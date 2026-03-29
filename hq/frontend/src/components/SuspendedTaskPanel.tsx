'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { API_CONFIG } from '../utils/constants';

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
    async function loadThoughtChain() {
      if (!taskId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/executions?taskId=${taskId}&limit=10`);
        const payload = (await response.json()) as ExecutionTracePayload;

        if (!response.ok) {
          throw new Error(payload.error || '加载执行记录失败。');
        }

        if (payload.executions && payload.executions.length > 0) {
          const latestExecutionId = payload.executions[0].id;
          const traceResponse = await fetch(`${API_CONFIG.BASE_URL}/executions/${latestExecutionId}/trace`);
          const tracePayload = (await traceResponse.json()) as {
            trace?: { traceEvents?: TraceEvent[] };
            error?: string;
          };

          if (!traceResponse.ok) {
            throw new Error(tracePayload.error || '加载思考链失败。');
          }

          const events = tracePayload.trace?.traceEvents || [];
          const thoughtEvents = events.filter((e) => e.type === 'thought' || e.type === 'execution_event');
          setTraceEvents(thoughtEvents.length > 0 ? thoughtEvents : events);
        } else {
          setTraceEvents([]);
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : '加载思考链失败。');
      } finally {
        setLoading(false);
      }
    }

    void loadThoughtChain();
  }, [taskId]);

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function getThoughtEmoji(type: string): string {
    switch (type) {
      case 'thought':
      case 'execution_event':
        return '🤔';
      case 'execution_started':
        return '▶️';
      case 'execution_completed':
        return '✅';
      case 'execution_failed':
        return '❌';
      case 'tool_call_logged':
        return '🔧';
      default:
        return '📝';
    }
  }

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-amber-100/50 transition-colors text-left"
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
        <div className="border-t border-amber-200 bg-amber-50/50 px-4 py-3">
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
                    <span className="text-sm">{getThoughtEmoji(event.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-amber-600">{formatTimestamp(event.occurredAt)}</span>
                      </div>
                      {event.summary && (
                        <p className="mt-1 text-xs text-slate-700 leading-relaxed">{event.summary}</p>
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
