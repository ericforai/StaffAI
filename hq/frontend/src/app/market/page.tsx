'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAgents } from '../../hooks/useAgents';
import { AgentCard } from '../../components/AgentCard';
import { DEPT_MAP } from '../../utils/constants';

export default function MarketPage() {
  const { agents, activeIds, toggleAgent } = useAgents();
  const [search, setSearch] = useState('');
  const [currentDept, setCurrentDept] = useState<string | null>(null);

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          (search
            ? agent.frontmatter.name.toLowerCase().includes(search.toLowerCase()) ||
              agent.frontmatter.description.toLowerCase().includes(search.toLowerCase())
            : true) && (!currentDept || agent.department === currentDept)
      ),
    [agents, search, currentDept]
  );

  const deptStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const agent of agents) {
      stats[agent.department] = (stats[agent.department] || 0) + 1;
    }
    return stats;
  }, [agents]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AGENCY</span>
            <span>HQ CONSOLE</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">指挥部</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            总览
          </Link>
          <Link href="/market" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm">
            系统市场
          </Link>
          <Link href="/organization" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            组织阵容
          </Link>
          <Link href="/tasks" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            工作任务
          </Link>
          <Link href="/brainstorm" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            专家协作
          </Link>
          <Link href="/knowledge" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            知识资产
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">系统市场</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">面向招聘、选型与能力发现的专家池视图</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px] space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-6">
                  <div
                    onClick={() => {
                      setCurrentDept(null);
                      setSearch('');
                    }}
                    className="cursor-pointer group"
                  >
                    <h2 className={`text-base font-bold tracking-tight transition-colors ${!currentDept ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                      人才总览
                    </h2>
                  </div>

                  {currentDept && (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5">
                      <ChevronLeft
                        className="h-3.5 w-3.5 cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                        onClick={() => setCurrentDept(null)}
                      />
                      <span className="text-xs font-bold text-slate-700">{DEPT_MAP[currentDept]?.label}</span>
                    </div>
                  )}
                </div>

                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="检索职业能力、专业领域..."
                    className="w-full h-10 rounded-md border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-800 outline-none ring-offset-white transition-all focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (event.target.value) setCurrentDept(null);
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
              {!currentDept && !search &&
                Object.entries(DEPT_MAP).map(([key, dept]) => {
                  const Icon = dept.icon;
                  return (
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      key={key}
                      onClick={() => setCurrentDept(key)}
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="inline-flex rounded-md bg-slate-50 p-2 text-slate-600 border border-slate-100 transition-colors group-hover:bg-slate-100">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{deptStats[key] || 0} experts</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{dept.label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-normal">
                        {dept.label} 人才子库
                      </p>
                    </motion.button>
                  );
                })}

              {(currentDept || search) &&
                filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={activeIds.includes(agent.id)}
                    isWorking={false}
                    variant="grid"
                    onClick={toggleAgent}
                  />
                ))}
            </section>

            {(currentDept || search) && filteredAgents.length === 0 && (
              <section className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-400 text-xs">
                当前筛选下没有匹配专家。试试切换部门，或换一种更具体的能力关键词。
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
