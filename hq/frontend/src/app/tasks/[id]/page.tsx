'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { useTaskDetail } from '../../../hooks/useTaskDetail';
import { useTaskActions } from '../../../hooks/useTaskActions';
import { useTaskEvents } from '../../../hooks/useTaskEvents';
import { usePendingHumanInputs } from '../../../hooks/usePendingHumanInputs';
import { useGlobalWebSocket, type WsMessage } from '../../../hooks/useGlobalWebSocket';
import { useAgents } from '../../../hooks/useAgents';
import { useApprovalActions } from '../../../hooks/useApprovalActions';
import type { TaskEvent } from '../../../types';
import { API_CONFIG } from '../../../utils/constants';
import { SuspendedTaskPanel } from '../../../components/SuspendedTaskPanel';
import { HumanInputPanel } from '../../../components/tasks/HumanInputPanel';
import { TaskInfoCard } from '../../../components/tasks/TaskInfoCard';
import { WorkflowPlanPanel } from '../../../components/tasks/WorkflowPlanPanel';
import { AssignmentPanel } from '../../../components/tasks/AssignmentPanel';
import { ExecutionList } from '../../../components/tasks/ExecutionList';
import { EventTimeline } from '../../../components/tasks/EventTimeline';
import { ArtifactsPanel } from '../../../components/tasks/ArtifactsPanel';
import { ApprovalDetailPanel } from '../../../components/approvals/ApprovalDetailPanel';

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
  const { executeTask, pauseTask, submitting, error: actionError } = useTaskActions(taskId, setData);
  const { events, loading: eventsLoading, refresh: refreshEvents, pushEvent } = useTaskEvents(taskId);
  const { inputs: pendingInputs, submitting: inputSubmitting, submitError, respondToAssignment, reload: reloadInputs } = usePendingHumanInputs(taskId);
  const { agents } = useAgents();
  const { approveApproval, rejectApproval, pendingId } = useApprovalActions(data?.approvals || []);

  // State
  const [selectedExecutor, setSelectedExecutor] = useState<'openai' | 'claude' | 'codex' | 'deerflow'>('claude');
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'plan' | 'artifacts'>('overview');

  // Derived Data
  const workflowPlan = data?.workflowPlan ?? data?.task.workflowPlan ?? null;
  const assignments = data?.assignments ?? data?.task.assignments ?? [];
  const pendingApproval = (data?.approvals || []).find(a => a.status === 'pending');

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
    const missingAgents = assignments.filter(
      (a) => !agents.some((agent) => agent.id === a.agentId) && !a.agentName
    );
    if (missingAgents.length > 0) {
      const missingRoles = missingAgents.map((a) => a.agentId).join(', ');
      alert(`组织中缺少以下类型的专家：${missingRoles}\n\n请先前往人才市场聘用对应的专家。`);
      return;
    }
    // Find the latest running execution to pause
    const runningExecution = data?.executions?.find((e) => e.status === 'running');
    if (!runningExecution) {
      alert('没有正在运行的任务可以暂停');
      return;
    }
    const success = await pauseTask(runningExecution.id);
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
          {/* Left Column: Task Info & Plan & Artifacts */}
          <div className="space-y-6">
            {pendingApproval && (
              <ApprovalDetailPanel
                approval={pendingApproval}
                loading={!!pendingId}
                onApprove={async () => {
                  await approveApproval(pendingApproval.id);
                  await reload();
                }}
                onReject={async () => {
                  await rejectApproval(pendingApproval.id);
                  await reload();
                }}
              />
            )}

            <TaskInfoCard
              task={data.task}
              latestExecution={data.executions?.[0] ?? null}
              selectedExecutor={selectedExecutor}
              setSelectedExecutor={setSelectedExecutor}
              onExecute={handleExecuteTask}
              onPause={handlePauseTask}
              loading={submitting}
            />

            {/* Tabs for Plan / Artifacts */}
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur-sm">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  执行摘要
                </button>
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === 'plan' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  工作计划
                </button>
                <button
                  onClick={() => setActiveTab('artifacts')}
                  className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === 'artifacts' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  交付产物
                </button>
              </div>
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <ExecutionList
                  executions={data.executions}
                  expandedId={expandedExecutionId}
                  onExpand={setExpandedExecutionId}
                />
                <AssignmentPanel assignments={assignments} />
              </div>
            )}

            {activeTab === 'plan' && (
              <WorkflowPlanPanel workflowPlan={workflowPlan} />
            )}

            {activeTab === 'artifacts' && (
              <ArtifactsPanel assignments={assignments} />
            )}
          </div>

          {/* Right Column: Timeline & HITL */}
          <div className="space-y-6">
            <SuspendedTaskPanel />
            
            {pendingInputs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">需要人类输入</h3>
                {pendingInputs.map(input => (
                  <HumanInputPanel
                    key={input.id}
                    input={input}
                    onSubmit={(response) => respondToAssignment(input.assignmentId, response)}
                    loading={inputSubmitting}
                  />
                ))}
              </div>
            )}

            <EventTimeline
              events={events}
              loading={eventsLoading}
              error={null}
              onRefresh={refreshEvents}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
