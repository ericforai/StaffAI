'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAgents } from '../hooks/useAgents';
import { useTasks } from '../hooks/useTasks';
import { DEPT_MAP } from '../utils/constants';
import { Building2, ClipboardList, BrainCircuit, BookOpenText } from 'lucide-react';

export default function Dashboard() {
  const { agents, activeIds, loading: agentsLoading } = useAgents();
  const { tasks, loading: tasksLoading } = useTasks();

  const isLoading = agentsLoading || tasksLoading;

  const deptStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const agent of agents) {
      stats[agent.department] = (stats[agent.department] || 0) + 1;
    }
    return stats;
  }, [agents]);

  const quickAccessCards = [
    { href: '/organization', title: '组织架构', desc: '管理阵容与在岗状态', color: 'from-emerald-500 to-teal-500', icon: Building2 },
    { href: '/tasks', title: '工作任务', desc: '任务执行与审批链路', color: 'from-amber-500 to-orange-500', icon: ClipboardList },
    { href: '/brainstorm', title: '专家协作', desc: '多专家讨论与顾问求解', color: 'from-purple-500 to-violet-500', icon: BrainCircuit },
    { href: '/knowledge', title: '知识资产', desc: '历史结论与专家归档', color: 'from-rose-500 to-pink-500', icon: BookOpenText },
  ];

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-500">正在同步数据...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Access Cards */}
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickAccessCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-lg"
                  >
                    <div className={`inline-flex rounded-lg bg-gradient-to-br ${card.color} p-2.5 text-white mb-4`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">{card.desc}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">进入 →</span>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </section>

          {/* Stats Overview */}
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">专家总数</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{agents.length}</p>
              <p className="mt-1 text-xs text-slate-500">来自 {Object.keys(DEPT_MAP).length} 个部门</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">在岗专家</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{activeIds.length}</p>
              <p className="mt-1 text-xs text-slate-500">当前活跃阵容</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">任务总数</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{tasks.length}</p>
              <p className="mt-1 text-xs text-slate-500">进行中的工作</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">部门分布</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(deptStats).slice(0, 4).map(([key, count]) => (
                  <span key={key} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {DEPT_MAP[key]?.label || key}: {count}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
