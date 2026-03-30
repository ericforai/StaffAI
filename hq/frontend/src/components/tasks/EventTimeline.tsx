'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTimestamp } from '../../utils/dateFormatter';
import { formatTaskEventType } from '../../utils/formatters';
import type { TaskEvent } from '../../types';

interface EventTimelineProps {
  events: TaskEvent[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function EventTimeline({ events, loading, error, onRefresh }: EventTimelineProps) {
  return (
    <div className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] tracking-[0.2em] text-slate-500">任务事件</p>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black tracking-[0.18em] text-slate-600 hover:border-slate-300 hover:text-slate-950"
        >
          刷新
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {loading && <p className="text-sm text-slate-500">正在加载任务事件…</p>}
        {error && (
          <div className="rounded-[1.1rem] border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-black tracking-[0.2em] text-rose-700">任务事件加载失败</p>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black tracking-[0.2em] text-rose-700 transition-all hover:border-rose-300 hover:bg-rose-100"
            >
              重试事件加载
            </button>
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <p className="text-sm text-slate-500">当前任务暂无事件记录。</p>
        )}
        {events.map((event, index) => (
          <div key={`${event.taskEventType}-${event.timestamp}-${index}`} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfaf5] p-4 text-sm text-slate-700">
            <p className="font-black text-slate-900">{formatTaskEventType(event.taskEventType)}</p>
            <p className="mt-1 text-sm text-slate-600">{event.message}</p>
            {event.taskEventType === 'execution_event' && event.payload?.content && (
              <div className="mt-2 prose prose-slate prose-xs max-w-full text-slate-600 bg-white/50 p-2 rounded-lg border border-slate-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.payload.content}</ReactMarkdown>
              </div>
            )}
            <p className="mt-1 text-[11px] tracking-[0.16em] text-slate-500">{formatTimestamp(event.timestamp)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
