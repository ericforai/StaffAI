/**
 * 专家卡片组件（侧边栏和主区域通用）
 */
import { motion } from 'framer-motion';
import { UserMinus, Loader2, Zap } from 'lucide-react';
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
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, x: -50 }}
        key={agent.id}
        className={`rounded-[1.7rem] border p-4 transition-all group relative overflow-hidden ${
          isWorking
            ? 'border-[#b8c9d2] bg-[#eef4f6] shadow-[0_10px_24px_rgba(112,143,160,0.14)]'
            : 'border-[#e8dfd4] bg-[#fcf8f2] hover:border-[#cfbfac]'
        }`}
      >
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white text-2xl shadow-sm">
              {agent.frontmatter.emoji || '🤖'}
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-slate-900">{agent.frontmatter.name}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] font-black tracking-[0.18em] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9b8164]" />
                {department?.label}
              </div>
            </div>
          </div>
          {isWorking ? (
            <div className="relative h-10 w-10 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 rounded-full bg-[#dce8ee]"
              />
              <Loader2 className="h-6 w-6 animate-spin text-[#708fa0]" />
            </div>
          ) : (
            <button
              onClick={() => onToggle?.(agent.id)}
              className="rounded-2xl bg-white p-3 text-[#9b8164] opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:bg-[#efe7dc] hover:text-slate-900"
            >
              <UserMinus className="w-6 h-6" />
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      key={agent.id}
      onClick={() => onClick?.(agent.id)}
      className={`group relative cursor-pointer overflow-hidden rounded-[1.8rem] border p-6 transition-all duration-300 ${
        isActive
          ? 'border-[#b8c9d2] bg-[#f2f7f8] shadow-[0_14px_32px_rgba(112,143,160,0.14)]'
          : 'border-[#e8dfd4] bg-[#fffaf5] hover:border-[#cfbfac] hover:bg-[#faf4eb] shadow-[0_10px_26px_rgba(128,110,82,0.06)]'
      } ${isWorking ? 'ring-4 ring-[#d7e5ea]' : ''}`}
    >
      <div className="mb-6 flex items-start justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-white text-3xl shadow-sm">
          {agent.frontmatter.emoji || '🤖'}
        </div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black tracking-[0.15em] ${
          isActive ? 'bg-[#dce8ee] text-slate-700' : 'bg-[#f1ebe2] text-slate-500'
        }`}>
          {DeptIcon ? <DeptIcon className="w-4 h-4" /> : null}
          {department?.label}
        </div>
      </div>
      <h3 className="mb-3 text-[1.6rem] font-black leading-tight tracking-tight text-slate-900">
        {agent.frontmatter.name}
      </h3>
      <p className="line-clamp-4 text-[15px] font-medium leading-7 text-slate-600 transition-colors group-hover:text-slate-800">
        {agent.frontmatter.description}
      </p>

      {isActive && (
        <div className="absolute bottom-5 right-5">
          <Zap className={`h-7 w-7 ${isWorking ? 'animate-pulse text-[#708fa0] fill-[#708fa0]' : 'text-[#d8ccc0]'}`} />
        </div>
      )}
    </motion.div>
  );
}
