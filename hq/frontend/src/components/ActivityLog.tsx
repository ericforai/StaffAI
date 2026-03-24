/**
 * 实时作战日志组件
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';

export interface ActivityLog {
  id: string;
  type:
    | 'AGENT_WORKING'
    | 'AGENT_HIRED'
    | 'AGENT_FIRED'
    | 'SQUAD_UPDATED'
    | 'CONNECTED'
    | 'AGENT_ASSIGNED'
    | 'AGENT_TASK_COMPLETED'
    | 'DISCUSSION_STARTED'
    | 'DISCUSSION_COMPLETED'
    | 'TOOL_PROGRESS';
  agentName: string;
  task?: string;
  timestamp: Date;
}

export interface ActivityLogProps {
  activities: ActivityLog[];
  wsStatus: 'connecting' | 'connected' | 'disconnected';
}

export function ActivityLog({ activities, wsStatus }: ActivityLogProps) {
  const formatLogType = (type: ActivityLog['type']) => {
    switch (type) {
      case 'AGENT_WORKING':
        return '// 执行任务: ...';
      case 'AGENT_HIRED':
        return '>> 成功入职';
      case 'AGENT_FIRED':
        return '<< 已离职';
      case 'SQUAD_UPDATED':
        return ':: 架构同步完成';
      case 'CONNECTED':
        return '++ 指挥部链路就绪';
      case 'AGENT_ASSIGNED':
        return '=> 已分配讨论任务';
      case 'AGENT_TASK_COMPLETED':
        return '== 已提交专家回复';
      case 'DISCUSSION_STARTED':
        return '## 专家讨论已启动';
      case 'DISCUSSION_COMPLETED':
        return '## 专家讨论已完成';
      case 'TOOL_PROGRESS':
        return '~~ 工具执行阶段更新';
      default:
        return '';
    }
  };

  return (
    <div className="mt-10 pt-10 border-t border-white/5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
          <Activity className="w-4 h-4 text-cyan-500" /> 实时作战日志
        </h2>
        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
          wsStatus === 'connected' ? 'bg-cyan-500/10 text-cyan-500' : 'bg-rose-500/10 text-rose-500'
        }`}>
          {wsStatus === 'connected' ? 'Link Stable' : 'Offline'}
        </div>
      </div>
      <div className="space-y-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
        <AnimatePresence mode="popLayout">
          {activities.map(log => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key={log.id}
              className="text-xs flex gap-4 leading-relaxed p-3 bg-white/[0.02] border border-white/5 rounded-xl"
            >
              <span className="text-slate-600 font-mono font-bold">
                {log.timestamp.toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="text-slate-300">
                <span className="font-black text-white">{log.agentName}</span>{' '}
                <span className="opacity-60 italic text-[11px]">
                  {log.type === 'AGENT_WORKING' && `// 执行任务: ${log.task?.substring(0, 25)}...`}
                  {log.type === 'TOOL_PROGRESS' && `${log.task || formatLogType(log.type)}`}
                  {log.type !== 'AGENT_WORKING' && log.type !== 'TOOL_PROGRESS' && formatLogType(log.type)}
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
