'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAgents } from '../../hooks/useAgents';
import { useWebSocket } from '../../hooks/useWebSocket';

type AgentWithProfile = {
  id: string;
  department: string;
  frontmatter: { name: string; description: string };
  profile?: {
    role?: string;
    riskScope?: string;
    allowedTaskTypes?: string[];
  };
};

export default function EmployeesPage() {
  const { agents, activeIds } = useAgents();
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<'all' | string>('all');
  const { status: wsStatus } = useWebSocket({ onMessage: () => {} });

  const enrichedAgents = agents as unknown as AgentWithProfile[];

  const departments = useMemo(() => {
    const set = new Set(enrichedAgents.map((agent) => agent.department).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [enrichedAgents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedAgents.filter((agent) => {
      if (dept !== 'all' && agent.department !== dept) return false;
      if (!q) return true;
      const haystack = `${agent.id} ${agent.frontmatter?.name ?? ''} ${agent.frontmatter?.description ?? ''} ${agent.profile?.role ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [enrichedAgents, query, dept]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AI员工</span>
            <span>管理中心</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">管理系统</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            总览
          </Link>
          <Link href="/market" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            人才市场
          </Link>
          <div className="space-y-1">
            <Link href="/organization" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              组织架构
            </Link>
            <Link href="/employees" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm pl-10">
              员工列表
            </Link>
          </div>
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

        <div className="p-4 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">系统状态</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {wsStatus === 'connected' ? '已连接' : '同步中...'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">员工列表</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">统一查看员工档案与在岗状态</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px]">
            <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  data-testid="employees-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索员工（name / id / role）"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
                />
                <select
                  data-testid="employees-dept-filter"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800"
                >
                  {departments.map((value) => (
                    <option key={value} value={value}>
                      {value === 'all' ? '全部部门' : value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div data-testid="employees-list" className="grid gap-4 md:grid-cols-2">
              {visible.map((agent) => {
                const isActive = activeIds.includes(agent.id);
                return (
                  <div key={agent.id} className="rounded-lg border border-slate-200 bg-white p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black tracking-[0.2em] text-slate-500">{agent.department}</p>
                        <h2 className="mt-2 text-xl font-black text-slate-900">{agent.frontmatter?.name ?? agent.id}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{agent.frontmatter?.description ?? '—'}</p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                          isActive ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {isActive ? '在岗' : '未在岗'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black tracking-[0.16em] text-slate-500">Role</p>
                        <p className="mt-2 text-sm font-black text-slate-900">{agent.profile?.role ?? '—'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black tracking-[0.16em] text-slate-500">Risk</p>
                        <p className="mt-2 text-sm font-black text-slate-900">{agent.profile?.riskScope ?? '—'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-black tracking-[0.16em] text-slate-500">Task Types</p>
                        <p className="mt-2 text-sm font-black text-slate-900">
                          {(agent.profile?.allowedTaskTypes ?? []).slice(0, 2).join(', ') || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
