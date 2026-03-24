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
        className={`p-5 rounded-[2rem] border transition-all group relative overflow-hidden ${
          isWorking
            ? 'bg-cyan-500/20 border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.3)]'
            : 'bg-white/5 border-white/5 hover:border-white/20'
        }`}
      >
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-5">
            <span className="text-5xl drop-shadow-lg">{agent.frontmatter.emoji || '🤖'}</span>
            <div>
              <div className="text-lg font-black text-white tracking-tight">{agent.frontmatter.name}</div>
              <div className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-widest flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500/50" />
                {department?.label}
              </div>
            </div>
          </div>
          {isWorking ? (
            <div className="relative h-10 w-10 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-cyan-500/20 rounded-full"
              />
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <button
              onClick={() => onToggle?.(agent.id)}
              className="opacity-0 group-hover:opacity-100 p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-xl"
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
      className={`cursor-pointer p-12 rounded-[4rem] border-[3px] transition-all duration-500 relative overflow-hidden backdrop-blur-2xl ${
        isActive
          ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_60px_rgba(6,182,212,0.3)] scale-[1.02]'
          : 'bg-white/[0.03] border-white/5 hover:border-white/30 hover:bg-white/[0.06] shadow-2xl'
      } ${isWorking ? 'ring-[8px] ring-cyan-400 ring-offset-[16px] ring-offset-[#0a0c10]' : ''}`}
    >
      <div className="flex justify-between items-start mb-10">
        <span className="text-7xl drop-shadow-2xl">{agent.frontmatter.emoji || '🤖'}</span>
        <div className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 ${
          isActive ? 'bg-cyan-500 text-black shadow-2xl' : 'bg-white/10 text-slate-400'
        }`}>
          {DeptIcon ? <DeptIcon className="w-4 h-4" /> : null}
          {department?.label}
        </div>
      </div>
      <h3 className="text-4xl font-black text-white mb-6 tracking-tighter group-hover:text-cyan-400 leading-none">
        {agent.frontmatter.name}
      </h3>
      <p className="text-xl text-slate-300 line-clamp-6 leading-relaxed font-bold group-hover:text-white transition-colors">
        {agent.frontmatter.description}
      </p>

      {isActive && (
        <div className="absolute bottom-0 right-0 p-10">
          <Zap className={`w-10 h-10 ${isWorking ? 'text-cyan-400 fill-cyan-400 animate-pulse' : 'text-cyan-900/50'}`} />
        </div>
      )}
    </motion.div>
  );
}
