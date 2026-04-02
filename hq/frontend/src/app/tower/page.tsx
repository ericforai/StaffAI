'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { useTasks } from '../../hooks/useTasks';
import { useAgents } from '../../hooks/useAgents';
import { useGlobalWebSocket, WsMessage } from '../../hooks/useGlobalWebSocket';
import { BarChart3, Activity, Target, Plus, Loader2, AlertTriangle } from 'lucide-react';
import type { TaskExecution } from '../../types/domain';
import { TowerMonitor } from '../../components/tower/TowerMonitor';
import { OKRManager } from '../../components/tower/OKRManager';

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: string;
  message: string;
}

export default function TowerView() {
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks();
  const { agents, activeIds, loading: agentsLoading } = useAgents();
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'okr'>('monitor');

  const [executionsLoading, setExecutionsLoading] = useState(true);
  const [executionsError, setExecutionsError] = useState<string | null>(null);

  // Fetch executions
  useEffect(() => {
    const fetchExecutions = async () => {
      setExecutionsLoading(true);
      try {
        const payload = await apiClient.get<{ executions: TaskExecution[] }>('/executions?limit=50');
        setExecutions(payload.executions || []);
      } catch (err) {
        setExecutionsError('加载执行记录失败');
      } finally {
        setExecutionsLoading(false);
      }
    };
    fetchExecutions();
  }, []);

  // WebSocket
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

  const isGlobalLoading = tasksLoading || agentsLoading || executionsLoading;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <BarChart3 size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Strategic Ops</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            战略控制塔
            {isGlobalLoading && <Loader2 className="h-6 w-6 animate-spin text-blue-500" />}
          </h1>
          <p className="text-slate-500 max-w-lg leading-relaxed text-sm">
            实时监控组织运行状态并管理长期战略目标。
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'monitor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity size={16} />
            实时监控
          </button>
          <button
            onClick={() => setActiveTab('okr')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'okr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Target size={16} />
            战略 OKR
          </button>
        </div>
      </header>

      {/* Errors */}
      {(tasksError || executionsError) && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-4 shadow-sm">
          <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0" />
          <div>
            <p className="font-black text-rose-800 uppercase tracking-widest text-xs">数据加载异常</p>
            <p className="text-sm text-rose-600 mt-1 font-medium">{tasksError || executionsError}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="min-h-[600px]">
        {activeTab === 'monitor' ? (
          <TowerMonitor 
            tasks={tasks} 
            agents={agents} 
            activeIds={activeIds} 
            executions={executions} 
            activities={activities} 
          />
        ) : (
          <OKRManager />
        )}
      </div>
    </div>
  );
}
