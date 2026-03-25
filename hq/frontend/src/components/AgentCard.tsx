/**
 * 专家卡片组件（侧边栏和主区域通用）
 */
import { motion } from 'framer-motion';
import { UserMinus, Loader2, Zap, BriefcaseBusiness } from 'lucide-react';
import { DEPT_MAP } from '../utils/constants';
import { Agent } from '../types';

export interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
  isWorking: boolean;
  variant: 'sidebar' | 'grid';
  onToggle?: (id: string) => void;
  onClick?: (id: string) => void;
}

export function AgentCard({ agent, isActive, isWorking, variant, onToggle, onClick }: AgentCardProps) {
  const department = DEPT_MAP[agent.department];
  const DeptIcon = department?.icon;

  if (variant === 'sidebar') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        key={agent.id}
        className={`rounded-lg border p-3 transition-all duration-200 group relative ${
          isWorking
            ? 'border-sky-200 bg-sky-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-50 border border-slate-100">
              {DeptIcon ? (
                <DeptIcon className="h-4 w-4 text-slate-600" />
              ) : (
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 leading-tight">{agent.frontmatter.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                {department?.label}
              </div>
            </div>
          </div>
          {isWorking ? (
            <div className="flex h-8 w-8 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
            </div>
          ) : (
            <button
              onClick={() => onToggle?.(agent.id)}
              className="rounded-md p-1.5 text-slate-400 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <UserMinus className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // Grid variant
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      key={agent.id}
      onClick={() => onClick?.(agent.id)}
      className={`group relative cursor-pointer rounded-lg border p-4 transition-all duration-200 ${
        isActive
          ? 'border-sky-200 bg-sky-50/40 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      } ${isWorking ? 'ring-2 ring-sky-100' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 border border-slate-100">
          {DeptIcon ? (
            <DeptIcon className="h-5 w-5 text-slate-600" />
          ) : (
            <BriefcaseBusiness className="h-5 w-5 text-slate-600" />
          )}
        </div>
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide ${
          isActive ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
        }`}>
          {DeptIcon ? <DeptIcon className="w-3 h-3" /> : null}
          {department?.label}
        </div>
      </div>
      <h3 className="mb-1.5 text-sm font-bold leading-snug text-slate-900">
        {agent.frontmatter.name}
      </h3>
      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 transition-colors duration-200 group-hover:text-slate-600">
        {agent.frontmatter.description}
      </p>

      {isActive && (
        <div className="absolute bottom-3 right-3">
          <Zap className={`h-4 w-4 ${isWorking ? 'animate-pulse text-sky-500 fill-sky-500' : 'text-slate-300'}`} />
        </div>
      )}
    </motion.div>
  );
}
