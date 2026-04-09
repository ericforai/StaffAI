'use client';

import { useAgents } from '../../hooks/useAgents';
import Link from 'next/link';
import { BrainCircuit, Search, ArrowRight, TrendingUp } from 'lucide-react';
import { AgentCard } from '../../components/AgentCard';
import { AGENT_DESCRIPTION_ZH, DEPT_MAP } from '../../utils/constants';

export default function AgentsIndexPage() {
  const { agents, activeIds, loading } = useAgents();

  return (
    <main className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-600">
            <BrainCircuit size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">资产管理</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">人才进化档案</h1>
          <p className="text-slate-500 max-w-lg leading-relaxed">
            查看组织内所有专家的成长轨迹、专属记忆与信任等级。
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-center px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">资产总数</p>
            <p className="text-2xl font-black text-slate-900">{agents.length}</p>
          </div>
          <div className="text-center px-6 py-3 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">当前活跃</p>
            <p className="text-2xl font-black text-blue-600">{activeIds.length}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <Link key={agent.id} href={`/agents/${agent.id}`} className="group block h-full">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={80} />
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-lg">
                  {agent.frontmatter.name[0]}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{agent.frontmatter.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {DEPT_MAP[agent.department]?.label ?? agent.department}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-6 flex-1 italic">
                {AGENT_DESCRIPTION_ZH[agent.id] ?? agent.frontmatter.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">查看进化</span>
                <ArrowRight size={14} className="text-slate-300 group-hover:translate-x-1 group-hover:text-blue-500 transition-all" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
