/**
 * 专家卡片组件（侧边栏和主区域通用）
 */
import { motion } from 'framer-motion';
import Link from 'next/link';
import { UserMinus, Loader2, Zap, BriefcaseBusiness, UserPlus, Check, ExternalLink } from 'lucide-react';
import { AGENT_DESCRIPTION_ZH, DEPT_MAP } from '../utils/constants';
import { Agent } from '../types';

export interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
  isWorking: boolean;
  variant: 'sidebar' | 'grid';
  onToggle?: (id: string) => void;
  onClick?: (id: string) => void;
  /** Show hire/fire button for market page */
  showHireButton?: boolean;
}

export function AgentCard({ agent, isActive, isWorking, variant, onToggle, onClick, showHireButton }: AgentCardProps) {
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
              <div className="text-sm font-semibold text-slate-900 leading-tight flex items-center gap-1.5">
                {agent.frontmatter.name}
                {isActive && (
                  <Link href={`/agents/${agent.id}`} className="text-slate-300 hover:text-blue-500 transition-colors">
                    <ExternalLink size={10} />
                  </Link>
                )}
              </div>
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
        <div className="flex items-center gap-2">
          {/* 入职状态标签 */}
          {isActive ? (
            <div className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700 border border-sky-100">
              <Check className="w-3 h-3" />
              <span>已入职</span>
            </div>
          ) : (
            <div className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500 border border-slate-100">
              待入职
            </div>
          )}
          <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide ${
            isActive ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
          }`}>
            {DeptIcon ? <DeptIcon className="w-3 h-3" /> : null}
            {department?.label}
          </div>
        </div>
      </div>
      <h3 className="mb-1.5 text-sm font-bold leading-snug text-slate-900">
        {agent.frontmatter.name}
      </h3>
      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 transition-colors duration-200 group-hover:text-slate-600">
        {AGENT_DESCRIPTION_ZH[agent.id] ?? agent.frontmatter.description}
      </p>

      {/* 入职/解聘按钮 */}
      {showHireButton && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex-1" />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(agent.id);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
                : 'border border-slate-900 bg-slate-900 text-white hover:border-slate-800 hover:bg-slate-800'
            }`}
          >
            {isActive ? (
              <>
                <UserMinus className="w-3.5 h-3.5" />
                解聘
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                入职
              </>
            )}
          </motion.button>
        </div>
      )}

      {isActive && !showHireButton && (
        <div className="absolute bottom-3 right-3">
          <Zap className={`h-4 w-4 ${isWorking ? 'animate-pulse text-sky-500 fill-sky-500' : 'text-slate-300'}`} />
        </div>
      )}
    </motion.div>
  );
}
