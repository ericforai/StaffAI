'use client';

import { History, Lightbulb, UserCheck, Zap } from 'lucide-react';
import type { AgentMemory } from '../types/domain';

interface Props {
  memory: AgentMemory | null;
  loading?: boolean;
}

export function AgentGrowthTimeline({ memory, loading }: Props) {
  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
    </div>;
  }

  if (!memory || (memory.experienceLog.length === 0 && memory.behavioralHeuristics.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
        <div className="p-4 bg-white rounded-full shadow-sm mb-4">
          <History className="text-slate-300" size={32} />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">暂无成长记录</p>
        <p className="mt-2 text-xs text-slate-500 max-w-[200px]">此专家会随着完成更多任务不断学习和进化。</p>
      </div>
    );
  }

  // Combine and sort events
  const events = [
    ...memory.experienceLog.map(e => ({
      id: e.id,
      type: 'experience' as const,
      title: e.title,
      content: e.insight,
      timestamp: e.timestamp,
      taskId: e.taskId
    })),
    ...memory.behavioralHeuristics.map(h => ({
      id: h.id,
      type: 'heuristic' as const,
      title: '学到新启发式',
      content: `Pattern: ${h.pattern}\nCorrection: ${h.correction}`,
      timestamp: h.timestamp,
      taskId: h.sourceTaskId
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:left-[19px] before:w-px before:bg-slate-200 before:pointer-events-none pb-4">
      {events.map((event) => (
        <div key={event.id} className="relative pl-12">
          {/* Timeline Dot */}
          <div className={`absolute left-0 top-1 p-2 rounded-full border-4 border-white shadow-sm z-10 ${
            event.type === 'experience' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
            {event.type === 'experience' ? <Lightbulb size={14} /> : <Zap size={14} />}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {new Date(event.timestamp).toLocaleDateString()}
              </span>
              <span className="text-[10px] font-bold text-slate-300 group-hover:text-blue-400 transition-colors">
                #{event.taskId.slice(-4)}
              </span>
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1">{event.title}</h4>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap italic">
              {event.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
