'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Activity, DollarSign, Users, AlertTriangle, BarChart3 } from 'lucide-react';
import type { Task, Agent, TaskExecution } from '../../types/domain';

interface HeatmapData {
  hour: number;
  count: number;
  label: string;
}

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: string;
  message: string;
}

interface Props {
  tasks: Task[];
  agents: Agent[];
  activeIds: string[];
  executions: TaskExecution[];
  activities: ActivityEvent[];
}

export function TowerMonitor({ tasks, agents, activeIds, executions, activities }: Props) {
  // KPI: Active Tasks (by status)
  const activeTasksStats = useMemo(() => {
    const running = tasks.filter((t) => t.status === 'running').length;
    const queued = tasks.filter((t) => t.status === 'queued' || t.status === 'routed').length;
    const waitingApproval = tasks.filter((t) => t.status === 'waiting_approval').length;
    return { running, queued, waitingApproval, total: running + queued + waitingApproval };
  }, [tasks]);

  // KPI: Total Cost
  const totalCost = useMemo(() => {
    let total = 0;
    executions.forEach(() => { total += 0.5; }); // Mock estimate
    return total;
  }, [executions]);

  // KPI: Agent Utilization
  const agentUtilization = useMemo(() => {
    const totalAgents = agents.length;
    if (totalAgents === 0) return 0;
    const activeStatuses = new Set(['running', 'routed', 'queued', 'waiting_approval']);
    const agentsWithTasks = tasks.filter((t) => t.assigneeId && activeStatuses.has(t.status)).length;
    return Math.round((agentsWithTasks / totalAgents) * 100);
  }, [agents, tasks]);

  // KPI: Risk Distribution
  const riskDistribution = useMemo(() => {
    const low = tasks.filter((t) => t.riskLevel?.toUpperCase() === 'LOW').length;
    const medium = tasks.filter((t) => t.riskLevel?.toUpperCase() === 'MEDIUM').length;
    const high = tasks.filter((t) => t.riskLevel?.toUpperCase() === 'HIGH').length;
    return { low, medium, high, total: low + medium + high };
  }, [tasks]);

  // Heatmap Color
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count <= 2) return 'bg-emerald-200';
    if (count <= 5) return 'bg-amber-300';
    return 'bg-rose-400';
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Tasks */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-blue-500/10 p-2.5">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">活跃任务</span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{activeTasksStats.total}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <span className="text-emerald-600 font-medium">运行中: {activeTasksStats.running}</span>
              <span className="text-amber-600 font-medium">队列中: {activeTasksStats.queued}</span>
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">估算成本</span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">${totalCost.toFixed(2)}</p>
            <p className="mt-2 text-xs text-slate-500">基于 {executions.length} 次执行</p>
          </div>
        </div>

        {/* Utilization */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-purple-500/10 p-2.5">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">资源利用率</span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{agentUtilization}%</p>
            <p className="mt-2 text-xs text-slate-500">{activeIds.length} / {agents.length} 专家活跃</p>
          </div>
        </div>

        {/* Risk */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-rose-500/10 p-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">风险概况</span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{riskDistribution.high}</p>
            <p className="mt-2 text-xs text-slate-500">高风险任务数</p>
          </div>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">实时活动</h2>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="rounded-full bg-slate-200 p-1.5 mt-0.5">
                <BarChart3 className="h-3 w-3 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{activity.message}</p>
                <p className="text-[10px] text-slate-400 uppercase font-black">{activity.type}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
