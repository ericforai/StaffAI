'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { useTaskDetail } from '../../../hooks/useTaskDetail';
import { useTaskActions } from '../../../hooks/useTaskActions';
import type { TaskExecutor } from '../../../hooks/useTaskActions';
import { useTaskEvents } from '../../../hooks/useTaskEvents';
import { useGlobalWebSocket, type WsMessage } from '../../../hooks/useGlobalWebSocket';
import { useAgents } from '../../../hooks/useAgents';
import { useExecutionTrace } from '../../../hooks/useExecutionTrace';
import { TaskInfoCard } from '../../../components/tasks/TaskInfoCard';
import { WorkflowPlanPanel } from '../../../components/tasks/WorkflowPlanPanel';
import { AssignmentPanel } from '../../../components/tasks/AssignmentPanel';
import { ExecutionList } from '../../../components/tasks/ExecutionList';
import { EventTimeline } from '../../../components/tasks/EventTimeline';
import type { TaskEvent } from '../../../types';
import { formatApprovalStatus } from '../../../utils/formatters';

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const { data, loading, error, setData, reload } = useTaskDetail(taskId);
  const { executeTask, pauseTask, resumeTask, cancelTask, submitting, error: actionError } = useTaskActions(taskId, setData);
  const { events, loading: eventsLoading, error: eventsError, refresh: refreshEvents, pushEvent } = useTaskEvents(taskId);
  const { agents } = useAgents();

  const workflowPlan = data?.workflowPlan ?? data?.task.workflowPlan ?? null;
  const assignments = data?.assignments ?? data?.task.assignments ?? [];
  const latestExecution = data?.executions[0] ?? null;

  const [selectedExecutor, setSelectedExecutor] = useState<TaskExecutor>('openai');
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

  // 当数据加载完成时，自动展开最新的执行记录
  useEffect(() => {
    try {
      const executions = data?.executions;
      if (executions && Array.isArray(executions) && executions.length > 0 && !expandedExecutionId) {
        setExpandedExecutionId(executions[0].id);
      }
    } catch (err) {
      console.error('Failed to auto-expand execution:', err);
    }
  }, [data, expandedExecutionId]);

  // 复制状态
  const [copiedExecutionId, setCopiedExecutionId] = useState<string | null>(null);

  // 复制输出摘要到剪贴板
  async function copyOutputSummary(executionId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedExecutionId(executionId);
      setTimeout(() => setCopiedExecutionId(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedExecutionId(executionId);
      setTimeout(() => setCopiedExecutionId(null), 2000);
    }
  }

  // 获取展开的执行记录的轨迹数据
  const { trace, loading: traceLoading, error: traceError, reload: reloadTrace } = useExecutionTrace(expandedExecutionId ?? '');

  const handleWsMessage = useCallback((message: WsMessage) => {
    if (message.type !== 'TASK_EVENT' || !message.taskEventType || !message.message || !message.timestamp) {
      return;
    }
    const event: TaskEvent = {
      type: 'TASK_EVENT',
      taskEventType: message.taskEventType,
      message: message.message,
      taskId: message.taskId,
      approvalId: message.approvalId,
      executionId: message.executionId,
      timestamp: message.timestamp,
      payload: message.payload,
    };
    pushEvent(event);
  }, [pushEvent]);

  const { status: wsStatus } = useGlobalWebSocket({
    onMessage: handleWsMessage,
  });

  async function handleExecuteTask() {
    const missingAgents = assignments.filter(
      a => !agents.some(agent => agent.id === a.agentId) && !a.agentName
    );

    if (missingAgents.length > 0) {
      const missingRoles = missingAgents.map(a => a.agentId).join(', ');
      alert(`组织中缺少以下类型的专家：${missingRoles}\n\n请先前往人才市场聘用对应的专家，然后再执行任务。`);
      return;
    }

    await executeTask(selectedExecutor);
    await refreshEvents();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_22%),#f6f1e7] px-4 py-8 text-slate-900 overflow-x-hidden">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.28em] text-slate-500">任务详情</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">任务详情</h1>
          </div>
          <Link href="/tasks" className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-950">
            返回任务列表
          </Link>
        </div>

        {loading && <p className="text-base text-slate-500">正在加载任务详情…</p>}
        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4">
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-rose-700">任务详情加载失败</p>
              <p className="mt-2 text-sm text-rose-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black tracking-[0.2em] text-rose-700 transition-all hover:border-rose-300 hover:bg-rose-100"
            >
              重试加载
            </button>
          </div>
        )}

        {actionError && <p className="mb-4 text-sm text-rose-600">{actionError}</p>}

        {data && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <TaskInfoCard 
                task={data.task}
                latestExecution={latestExecution}
                selectedExecutor={selectedExecutor}
                setSelectedExecutor={setSelectedExecutor}
                onExecute={handleExecuteTask}
                submitting={submitting}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <WorkflowPlanPanel workflowPlan={workflowPlan} />
                <AssignmentPanel assignments={assignments} agents={agents} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] tracking-[0.2em] text-slate-500">审批记录</p>
                <div className="mt-4 space-y-3">
                  {data.approvals.length === 0 && <p className="text-sm text-slate-500">当前没有审批记录。</p>}
                  {data.approvals.map((approval) => (
                    <div key={approval.id} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfaf5] p-4 text-sm text-slate-700">
                      <p className="font-black text-slate-900">{formatApprovalStatus(approval.status)}</p>
                      <p className="mt-1 text-xs text-slate-500">{approval.requestedAt}</p>
                    </div>
                  ))}
                </div>
              </div>

              <ExecutionList 
                executions={data.executions}
                expandedExecutionId={expandedExecutionId}
                setExpandedExecutionId={setExpandedExecutionId}
                copiedExecutionId={copiedExecutionId}
                copyOutputSummary={copyOutputSummary}
                trace={trace as any}
                traceLoading={traceLoading}
                traceError={traceError}
                reloadTrace={reloadTrace}
                onPause={pauseTask}
                onResume={resumeTask}
                onCancel={cancelTask}
                submitting={submitting}
              />

              <EventTimeline 
                events={events}
                loading={eventsLoading}
                error={eventsError}
                onRefresh={refreshEvents}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
