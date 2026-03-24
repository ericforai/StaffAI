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
      case 'TASK_EVENT':
        return ':: 任务状态事件';
      default:
        return '';
    }
  };

  return (
    <div className="border-t border-[#e9dfd3] pt-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-sm font-black tracking-[0.18em] text-slate-700">
          <Activity className="h-4 w-4 text-[#9b8164]" /> 现场动态
        </h2>
        <div className={`rounded-full px-3 py-1 text-[11px] font-black ${
          wsStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        }`}>
          {wsStatus === 'connected' ? '连接正常' : '连接中断'}
        </div>
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {activities.map(log => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key={log.id}
              className="flex gap-3 rounded-[1.1rem] border border-[#ebe2d7] bg-[#fcf8f2] p-3 text-sm leading-6"
            >
              <span className="font-mono text-xs font-bold text-slate-500">
                {log.timestamp.toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="text-slate-700">
                <span className="font-black text-slate-900">{log.agentName}</span>{' '}
                <span className="text-sm text-slate-600">
                  {log.type === 'AGENT_WORKING' && `// 执行任务: ${log.task?.substring(0, 25)}...`}
                  {(log.type === 'TOOL_PROGRESS' || log.type === 'TASK_EVENT') &&
                    `${log.task || formatLogType(log.type)}`}
                  {log.type !== 'AGENT_WORKING' &&
                    log.type !== 'TOOL_PROGRESS' &&
                    log.type !== 'TASK_EVENT' &&
                    formatLogType(log.type)}
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
