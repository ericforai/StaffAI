'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { useTaskDetail } from '../../../hooks/useTaskDetail';
import { useTaskActions } from '../../../hooks/useTaskActions';
import { useTaskEvents } from '../../../hooks/useTaskEvents';
import { useGlobalWebSocket, type WsMessage } from '../../../hooks/useGlobalWebSocket';
import { useAgents } from '../../../hooks/useAgents';
import type { TaskEvent } from '../../../types';
import { API_CONFIG } from '../../../utils/constants';
import { SuspendedTaskPanel } from '../../../components/SuspendedTaskPanel';
import { TaskInfoCard } from '../../../components/tasks/TaskInfoCard';
import { WorkflowPlanPanel } from '../../../components/tasks/WorkflowPlanPanel';
import { AssignmentPanel } from '../../../components/tasks/AssignmentPanel';
import { ExecutionList } from '../../../components/tasks/ExecutionList';
import { EventTimeline } from '../../../components/tasks/EventTimeline';

/**
 * Task Detail Page (StaffAI 1.0 Atomic Version)
 * 
 * This page uses atomic components refactored during the 1.0 GAP closure.
 * It integrates HITL (Human-in-the-loop) capabilities from the sprint branch.
 */
export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Data Fetching
  const { data, loading, error, setData, reload } = useTaskDetail(taskId);
  const { executeTask, suspendTask, submitting, error: actionError } = useTaskActions(taskId, setData);
  const { events, loading: eventsLoading, refresh: refreshEvents, pushEvent } = useTaskEvents(taskId);
  const { agents } = useAgents();

  // State
  const [selectedExecutor, setSelectedExecutor] = useState<'openai' | 'claude' | 'codex' | 'deerflow'>('openai');
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

  // Derived Data
  const workflowPlan = data?.workflowPlan ?? data?.task.workflowPlan ?? null;
  const assignments = data?.assignments ?? data?.task.assignments ?? [];

  // Auto-expand latest execution
  useEffect(() => {
    if (data?.executions?.length && !expandedExecutionId) {
      setExpandedExecutionId(data.executions[0].id);
    }
  }, [data, expandedExecutionId]);

  // WebSocket Integration
  const handleWsMessage = useCallback((message: WsMessage) => {
    if (message.type === 'TASK_EVENT' && message.taskId === taskId) {
      pushEvent({
        type: 'TASK_EVENT',
        taskEventType: message.taskEventType!,
        message: message.message!,
        taskId: message.taskId,
        approvalId: message.approvalId,
        executionId: message.executionId,
        timestamp: message.timestamp!,
        payload: message.payload,
      });
    }
  }, [taskId, pushEvent]);

  const { status: wsStatus } = useGlobalWebSocket({
    onMessage: handleWsMessage,
  });

  // Action Handlers
  async function handleExecuteTask() {
    const missingAgents = assignments.filter(
      a => !agents.some(agent => agent.id === a.agentId) && !a.agentName
    );

    if (missingAgents.length > 0) {
      const missingRoles = missingAgents.map(a => a.agentId).join(', ');
      alert(`组织中缺少以下类型的专家：${missingRoles}\n\n请先前往人才市场聘用对应的专家。`);
      return;
    }

    await executeTask(selectedExecutor);
    await refreshEvents();
  }

  async function handlePauseTask() {
    const success = await suspendTask('Manual pause by user');
    if (!success) {
      alert('暂停任务失败，请重试');
    }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1e7]">
      <p className="text-lg font-black text-slate-500 animate-pulse">正在加载任务详情...</p>
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1e7] p-8">
      <div className="max-w-md rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-xl">
        <h2 className="text-2xl font-black text-rose-600">加载失败</h2>
        <p className="mt-4 text-slate-600">{error || '任务不存在'}</p>
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={() => reload()} className="rounded-full bg-slate-900 px-6 py-2 text-white font-bold">重试</button>
          <Link href="/tasks" className="rounded-full border border-slate-200 px-6 py-2 font-bold">返回列表</Link>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_22%),#f6f1e7] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.28em] text-slate-500 uppercase">Task Dashboard</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">任务指挥台</h1>
          </div>
          <Link href="/tasks" className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:text-slate-950 transition-all">
            返回列表
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left Column: Task Info & Plan */}
          <div className="space-y-6">
            <TaskInfoCard 
              task={data.task}
              executor={selectedExecutor}
              onExecutorChange={setSelectedExecutor}
              onExecute={handleExecuteTask}
              onPause={handlePauseTask}
              submitting={submitting}
              actionError={actionError}
            />

            {data.task.status === 'suspended' && (
              <SuspendedTaskPanel 
                taskId={taskId} 
                onResumed={() => reload()} 
              />
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <WorkflowPlanPanel workflowPlan={workflowPlan} />
              <AssignmentPanel assignments={assignments} agents={agents} />
            </div>
          </div>

          {/* Right Column: Execution History & Events */}
          <div className="space-y-6">
            <ExecutionList 
              executions={data.executions}
              expandedId={expandedExecutionId}
              onToggleExpand={setExpandedExecutionId}
              onReload={reload}
            />

            <EventTimeline 
              events={events} 
              loading={eventsLoading} 
              onRefresh={refreshEvents} 
            />
          </div>
        </div>
      </div>
    </main>
  );
}
