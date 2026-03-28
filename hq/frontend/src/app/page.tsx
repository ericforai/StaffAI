'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Store, Building2, ClipboardList, BrainCircuit, BookOpenText, Clipboard } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAgents } from '../hooks/useAgents';
import { useTasks } from '../hooks/useTasks';
import { useWebSocket, WsMessage } from '../hooks/useWebSocket';
import { ActivityLog, ActivityLog as ActivityLogType } from '../components/ActivityLog';
import { DEPT_MAP } from '../utils/constants';

export default function Dashboard() {
  const { agents, activeIds, loading: agentsLoading } = useAgents();
  const { tasks, loading: tasksLoading } = useTasks();
  const [activities, setActivities] = useState<ActivityLogType[]>([]);

  const isLoading = agentsLoading || tasksLoading;

  const handleWsMessage = useCallback((data: WsMessage) => {
    if (['SQUAD_UPDATED', 'AGENT_HIRED', 'AGENT_FIRED'].includes(data.type)) {
      // syncSquad logic if needed
    }

    const newLog: ActivityLogType = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agentName: data.agentName || (data.type === 'CONNECTED' ? '系统中心' : '指挥部'),
      type: data.type as ActivityLogType['type'],
      task: data.type === 'TOOL_PROGRESS' || data.type === 'TASK_EVENT' ? data.message : data.task,
    };

    if (data.type === 'AGENT_WORKING' || data.type === 'AGENT_ASSIGNED') {
      setActivities((prev) => [newLog, ...prev].slice(0, 20));
    } else if (
      [
        'AGENT_HIRED',
        'AGENT_FIRED',
        'SQUAD_UPDATED',
        'CONNECTED',
        'AGENT_TASK_COMPLETED',
        'DISCUSSION_STARTED',
        'DISCUSSION_COMPLETED',
        'TOOL_PROGRESS',
        'TASK_EVENT',
      ].includes(data.type)
    ) {
      setActivities((prev) => [newLog, ...prev].slice(0, 20));
    }
  }, []);

  const { status: wsStatus } = useWebSocket({
    onMessage: handleWsMessage,
  });

  const deptStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const agent of agents) {
      stats[agent.department] = (stats[agent.department] || 0) + 1;
    }
    return stats;
  }, [agents]);

  const dashboardCards = [
    {
      key: 'market',
      title: '人才市场',
      description: '面向招聘、选型与能力发现的专家池视图',
      detail: '按部门浏览角色能力，快速检索合适专家',
      icon: Store,
      stats: `${agents.length} 专家`,
      href: '/market',
      color: 'from-blue-500 to-sky-500',
    },
    {
      key: 'organization',
      title: '组织架构',
      description: '围绕阵容管理、模板复用与在岗状态的组织视图',
      detail: '统一管理常用小队、当前在岗专家与动态流',
      icon: Building2,
      stats: `${activeIds.length} 在岗`,
      href: '/organization',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      key: 'tasks',
      title: '工作任务',
      description: '统一承接执行入口、审批链路与任务态势',
      detail: '聚合任务状态、最新事件与后续执行入口',
      icon: ClipboardList,
      stats: `${tasks.length} 任务`,
      href: '/tasks',
      color: 'from-amber-500 to-orange-500',
    },
    {
      key: 'brainstorm',
      title: '专家协作',
      description: '围绕议题发起多专家讨论与顾问求解',
      detail: '支持找人、聘用、协同讨论、顾问咨询',
      icon: BrainCircuit,
      stats: '多专家讨论',
      href: '/brainstorm',
      color: 'from-purple-500 to-violet-500',
    },
    {
      key: 'knowledge',
      title: '知识资产',
      description: '围绕历史结论、专家归档与检索回看的知识台',
      detail: '按来源、专家、关键词交叉筛选',
      icon: BookOpenText,
      stats: '知识沉淀',
      href: '/knowledge',
      color: 'from-rose-500 to-pink-500',
    },
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
            {dashboardCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.key} href={card.href}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-lg"
                  >
                    <div className={`inline-flex rounded-lg bg-gradient-to-br ${card.color} p-2.5 text-white mb-4`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">{card.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.stats}</p>
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
                    {key}: {count}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Activity Log */}
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clipboard className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">系统活动流</h3>
              </div>
              <span className={`h-2 w-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              <ActivityLog activities={activities} wsStatus={wsStatus} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
