/**
 * Real-time activity log component
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
    | 'TOOL_PROGRESS'
    | 'TASK_EVENT';
  agentName: string;
  task?: string;
  timestamp: Date;
}

export interface ActivityLogProps {
  activities: ActivityLog[];
  wsStatus: 'connecting' | 'connected' | 'disconnected';
}

function formatLogType(type: ActivityLog['type']): string {
  switch (type) {
    case 'AGENT_WORKING':
      return '正在执行任务';
    case 'AGENT_HIRED':
      return '专家已加入编组';
    case 'AGENT_FIRED':
      return '专家已移出编组';
    case 'SQUAD_UPDATED':
      return '阵容同步完成';
    case 'CONNECTED':
      return '实时链路已建立';
    case 'AGENT_ASSIGNED':
      return '讨论任务已分配';
    case 'AGENT_TASK_COMPLETED':
      return '专家回复已提交';
    case 'DISCUSSION_STARTED':
      return '专家讨论已启动';
    case 'DISCUSSION_COMPLETED':
      return '专家讨论已完成';
    case 'TOOL_PROGRESS':
      return '执行进度更新';
    case 'TASK_EVENT':
      return '任务状态更新';
    default:
      return '';
  }
}

function formatLogEntry(log: ActivityLog): string {
  if (log.type === 'AGENT_WORKING') {
    return `正在执行：${log.task?.substring(0, 30)}...`;
  }
  if (log.type === 'TOOL_PROGRESS' || log.type === 'TASK_EVENT') {
    return log.task || formatLogType(log.type);
  }
  return formatLogType(log.type);
}

export function ActivityLog({ activities, wsStatus }: ActivityLogProps) {
  return (
    <div className="border-t border-[#dbe3ef] pt-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-sm font-black tracking-[0.18em] text-slate-700">
          <Activity className="h-4 w-4 text-[#0369a1]" /> 现场动态
        </h2>
        <div className={`rounded-full px-3 py-1 text-[11px] font-black ${
          wsStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        }`}>
          {wsStatus === 'connected' ? '连接正常' : '连接中断'}
        </div>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {activities.map((log) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key={log.id}
              className="grid grid-cols-[80px_1fr] gap-2 rounded-lg border border-[#dbe3ef] bg-[#f8fafc] px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs font-bold text-slate-500">
                {log.timestamp.toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="text-slate-700">
                <span className="font-semibold text-slate-900">{log.agentName}</span>
                <span className="text-slate-500 mx-1">·</span>
                <span className="text-slate-600">{formatLogEntry(log)}</span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
