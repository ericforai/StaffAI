'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { API_CONFIG } from '../../utils/constants';
import { useTasks } from '../../hooks/useTasks';
import { useAgents } from '../../hooks/useAgents';
import { useGlobalWebSocket, WsMessage } from '../../hooks/useGlobalWebSocket';
import { BarChart3, Activity, DollarSign, Users, AlertTriangle } from 'lucide-react';
import type { ExecutionSummary } from '../../types';

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

export default function TowerView() {
  const { tasks } = useTasks();
  const { agents, activeIds } = useAgents();
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timestamp every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch executions data
  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/executions?limit=50`);
        if (response.ok) {
          const data = await response.json();
          setExecutions(data.executions || []);
        }
      } catch (error) {
        console.error('Failed to fetch executions:', error);
      }
    };
    fetchExecutions();
  }, []);

  // Handle WebSocket messages for activity feed
  const handleWsMessage = useCallback((data: WsMessage) => {
    const newEvent: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: data.type,
      message: data.message || data.task || `${data.type} event`,
    };

    setActivities((prev) => [newEvent, ...prev].slice(0, 10));
  }, []);

  useGlobalWebSocket({ onMessage: handleWsMessage });

  // KPI: Active Tasks (by status)
  const activeTasksStats = useMemo(() => {
    const running = tasks.filter((t) => t.status === 'running').length;
    const queued = tasks.filter((t) => t.status === 'queued').length;
    const suspended = tasks.filter((t) => t.status === 'suspended').length;
    return { running, queued, suspended, total: running + queued + suspended };
  }, [tasks]);

  // KPI: Total Cost (sum from executions)
  const totalCost = useMemo(() => {
    // Cost calculation: each execution has a cost field, or estimate from tool calls
    // For now, showing a mock calculation based on execution count
    return executions.length * 0.5; // $0.50 per execution as baseline
  }, [executions]);

  // KPI: Agent Utilization (% of agents with active assignments)
  const agentUtilization = useMemo(() => {
    const totalAgents = agents.length;
    if (totalAgents === 0) return 0;
    const agentsWithTasks = tasks.filter((t) => t.assigneeId && t.status === 'running').length;
    return Math.round((agentsWithTasks / totalAgents) * 100);
  }, [agents, tasks]);

  // KPI: Risk Distribution (LOW/MEDIUM/HIGH)
  const riskDistribution = useMemo(() => {
    const low = tasks.filter((t) => t.riskLevel === 'LOW').length;
    const medium = tasks.filter((t) => t.riskLevel === 'MEDIUM').length;
    const high = tasks.filter((t) => t.riskLevel === 'HIGH').length;
    return { low, medium, high, total: low + medium + high };
  }, [tasks]);

  // Execution Heatmap: Tasks per hour for last 24h
  const heatmapData = useMemo(() => {
    const data: HeatmapData[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Initialize 24 hour buckets
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      data.push({
        hour: hour.getHours(),
        count: 0,
        label: hour.getHours().toString().padStart(2, '0') + ':00',
      });
    }

    // Count executions per hour
    executions.forEach((exec) => {
      if (exec.startedAt) {
        const execTime = new Date(exec.startedAt);
        if (execTime >= twentyFourHoursAgo && execTime <= now) {
          const hourIndex = Math.floor((now.getTime() - execTime.getTime()) / (60 * 60 * 1000));
          const index = 23 - hourIndex;
          if (index >= 0 && index < 24) {
            data[index].count++;
          }
        }
      }
    });

    return data;
  }, [executions]);

  // Get color for heatmap cell based on count
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count <= 2) return 'bg-emerald-200';
    if (count <= 5) return 'bg-amber-300';
    return 'bg-rose-400';
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">战略控制塔</h1>
          <p className="mt-1 text-sm text-slate-500">实时监控与战略指标</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-400">更新时间</p>
          <p className="text-sm font-bold text-slate-700">{formatTimestamp(currentTime)}</p>
        </div>
      </header>

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
              <span className="text-rose-600 font-medium">暂停: {activeTasksStats.suspended}</span>
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">总成本</span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">${totalCost.toFixed(2)}</p>
            <p className="mt-2 text-xs text-slate-500">基于 {executions.length} 次执行</p>
          </div>
        </div>

        {/* Agent Utilization */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-purple-500/10 p-2.5">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">专家利用率</span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{agentUtilization}%</p>
            <p className="mt-2 text-xs text-slate-500">
              {activeIds.length} / {agents.length} 专家活跃
            </p>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-rose-500/10 p-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">风险分布</span>
          </div>
          <div className="mt-4">
            <div className="flex items-end gap-1">
              <div className="flex-1 bg-emerald-500 rounded-t" style={{ height: `${riskDistribution.total > 0 ? (riskDistribution.low / riskDistribution.total) * 100 : 0}%`, minHeight: '24px' }} />
              <div className="flex-1 bg-amber-500 rounded-t" style={{ height: `${riskDistribution.total > 0 ? (riskDistribution.medium / riskDistribution.total) * 100 : 0}%`, minHeight: '24px' }} />
              <div className="flex-1 bg-rose-500 rounded-t" style={{ height: `${riskDistribution.total > 0 ? (riskDistribution.high / riskDistribution.total) * 100 : 0}%`, minHeight: '24px' }} />
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <span className="text-emerald-600 font-medium">低: {riskDistribution.low}</span>
              <span className="text-amber-600 font-medium">中: {riskDistribution.medium}</span>
              <span className="text-rose-600 font-medium">高: {riskDistribution.high}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Execution Heatmap */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">执行热力图 (24小时)</h2>
        <div className="grid grid-cols-24 gap-1">
          {heatmapData.map((cell, index) => (
            <div
              key={index}
              className={`${getHeatmapColor(cell.count)} rounded-sm h-8 relative group`}
              title={`${cell.label}: ${cell.count} 次执行`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                {cell.count}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span>0</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 bg-slate-100 rounded-sm" />
            <div className="w-4 h-4 bg-emerald-200 rounded-sm" />
            <div className="w-4 h-4 bg-amber-300 rounded-sm" />
            <div className="w-4 h-4 bg-rose-400 rounded-sm" />
          </div>
          <span>6+</span>
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">最近活动</h2>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">暂无活动记录</p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className="rounded-full bg-slate-200 p-1.5 mt-0.5">
                  <BarChart3 className="h-3 w-3 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{activity.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activity.type} • {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
