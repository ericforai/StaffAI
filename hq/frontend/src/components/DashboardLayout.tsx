'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardList, BrainCircuit, BookOpenText, Clipboard, Store, BarChart3, ShieldCheck, Library } from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useTasks } from '../hooks/useTasks';
import { useGlobalWebSocket, WsMessage } from '../hooks/useGlobalWebSocket';
import { useWorkshopHealth } from '../hooks/useWorkshopHealth';
import { DEPT_MAP } from '../utils/constants';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { agents, activeIds, loading: agentsLoading } = useAgents();
  const { tasks } = useTasks();
  const pathname = usePathname();

  const [activities, setActivities] = useState<any[]>([]);

  const handleWsMessage = useCallback((data: WsMessage) => {
    const newLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agentName: data.agentName || (data.type === 'CONNECTED' ? '系统中心' : '指挥部'),
      type: data.type,
      task: data.type === 'TOOL_PROGRESS' || data.type === 'TASK_EVENT' ? data.message : data.task,
    };

    if (
      ['AGENT_WORKING', 'AGENT_ASSIGNED', 'AGENT_HIRED', 'AGENT_FIRED', 'SQUAD_UPDATED',
       'CONNECTED', 'AGENT_TASK_COMPLETED', 'DISCUSSION_STARTED', 'DISCUSSION_COMPLETED',
       'TOOL_PROGRESS', 'TASK_EVENT'].includes(data.type)
    ) {
      setActivities((prev) => [newLog, ...prev].slice(0, 20));
    }
  }, []);

  const { status: wsStatus } = useGlobalWebSocket({
    onMessage: handleWsMessage,
  });

  const { status: workshopStatus } = useWorkshopHealth();

  const navItems = [
    { href: '/', label: '总览', icon: null },
    { href: '/market', label: '人才市场', icon: Store },
    { href: '/organization', label: '组织架构', icon: Building2 },
    { href: '/agents', label: '人才档案', icon: BrainCircuit },
    { href: '/tasks', label: '工作任务', icon: ClipboardList },
    { href: '/templates', label: '模板中心', icon: Library },
    { href: '/approvals', label: '审批中心', icon: ShieldCheck },
    { href: '/brainstorm', label: '专家协作', icon: BrainCircuit },
    { href: '/knowledge', label: '知识资产', icon: BookOpenText },
    { href: '/tower', label: '战略控制塔', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar：高于页面内 fixed z-50 弹窗，避免全屏遮罩挡住全局导航（点击侧栏看似无反应） */}
      <aside className="relative z-[100] w-56 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AI员工</span>
            <span>管理中心</span>
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight text-slate-900">管理系统</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 space-y-2">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">WebSocket</span>
              <span className={`h-1.5 w-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {wsStatus === 'connected' ? '已连接' : '同步中...'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Workshop</span>
              <span className={`h-1.5 w-1.5 rounded-full ${workshopStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : workshopStatus === 'loading' ? 'bg-amber-400' : 'bg-rose-500'}`} />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {workshopStatus === 'connected' ? '正常运行' : workshopStatus === 'loading' ? '正在加载' : '未连接'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">
              {navItems.find((item) => item.href === pathname)?.label || '总览'}
            </h2>
          </div>

          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">专家</p>
              <p className="text-sm font-bold text-slate-900 leading-none mt-1">{activeIds.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">任务</p>
              <p className="text-sm font-bold text-slate-900 leading-none mt-1">{tasks.length}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
