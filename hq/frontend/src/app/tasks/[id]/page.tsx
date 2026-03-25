'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTaskDetail } from '../../../hooks/useTaskDetail';
import { useTaskActions } from '../../../hooks/useTaskActions';
import { useTaskEvents } from '../../../hooks/useTaskEvents';
import { useWebSocket, type WsMessage } from '../../../hooks/useWebSocket';
import type { TaskEvent } from '../../../types';

function formatTaskStatus(status: string) {
  switch (status) {
    case 'waiting_approval':
      return '等待审批';
    case 'completed':
      return '已完成';
    case 'running':
      return '执行中';
    case 'failed':
      return '执行失败';
    case 'pending':
      return '待开始';
    default:
      return status;
  }
}

function formatExecutionMode(executionMode: string) {
  switch (executionMode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    case 'advanced_discussion':
      return '高级讨论';
    case 'auto':
      return '自动';
    default:
      return executionMode;
  }
}

function formatWorkflowStepStatus(status?: string) {
  if (!status) {
    return '待确认';
  }

  switch (status) {
    case 'pending':
      return '待处理';
    case 'running':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'skipped':
      return '已跳过';
    default:
      return status;
  }
}

function formatApprovalStatus(status: string) {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'approved':
      return '已批准';
    case 'rejected':
      return '已拒绝';
    default:
      return status;
  }
}

function formatExecutionStatus(status: string) {
  switch (status) {
    case 'succeeded':
    case 'completed':
      return '成功';
    case 'failed':
      return '失败';
    case 'running':
      return '执行中';
    case 'pending':
      return '等待中';
    default:
      return status;
  }
}

function getTaskStatusMessage(status: string, executionMode: string) {
  if (status === 'waiting_approval') {
    return {
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
      title: '任务等待审批',
      body: '这个任务被识别为高风险动作，必须先在审批队列中通过后才能继续执行。',
    };
  }

  if (status === 'completed') {
    return {
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      title: '任务已完成',
      body: '当前任务已经执行完成，可以继续查看执行摘要或沿着相关审批/结果继续追踪。',
    };
  }

  if (executionMode === 'advanced_discussion') {
    return {
      tone: 'border-sky-200 bg-sky-50 text-sky-800',
      title: '高级讨论模式',
      body: '这个任务会走多专家讨论与综合路径，而不是普通单任务执行。',
    };
  }

  return {
    tone: 'border-slate-200 bg-white text-slate-700',
    title: '可直接执行',
    body: '当前任务处于可执行状态，可以直接在这里触发执行并查看 execution 结果。',
  };
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, loading, error, setData, reload } = useTaskDetail(taskId);
  const { executeTask, submitting, error: actionError } = useTaskActions(taskId, setData);
  const { events, loading: eventsLoading, error: eventsError, refresh: refreshEvents, pushEvent } = useTaskEvents(taskId);
  const workflowPlan = data?.workflowPlan ?? data?.task.workflowPlan ?? null;
  const assignments = data?.assignments ?? data?.task.assignments ?? [];
  const latestExecution = data?.executions[0] ?? null;
  const taskStatusMessage = data ? getTaskStatusMessage(data.task.status, data.task.executionMode) : null;

  useWebSocket({
    onMessage: (message: WsMessage) => {
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
      };
      pushEvent(event);
    },
  });

  async function handleExecuteTask() {
    await executeTask();
    await refreshEvents();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_22%),#f6f1e7] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
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
          <div
            data-testid="task-detail-error-state"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4"
          >
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-rose-700">任务详情加载失败</p>
              <p className="mt-2 text-sm text-rose-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black tracking-[0.2em] text-rose-700 transition-all hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {loading ? '重试中…' : '重试加载'}
            </button>
          </div>
        )}
        {actionError && <p className="mb-4 text-sm text-rose-600">{actionError}</p>}
        {!loading && !error && !data && (
          <div
            data-testid="task-detail-empty-state"
            className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 shadow-sm"
          >
            <p className="text-xs font-black tracking-[0.2em] text-slate-500">任务不存在或暂不可用</p>
            <p className="mt-2 text-sm text-slate-600">请返回任务列表确认任务是否已被清理，或稍后重试加载。</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
              >
                重试加载
              </button>
              <Link
                href="/tasks"
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-black tracking-[0.2em] text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100"
              >
                返回任务列表
              </Link>
            </div>
          </div>
        )}

        {data && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <h2 className="text-2xl font-black text-slate-950">{data.task.title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{data.task.description}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">状态</p>
                  <p className="mt-2 text-base font-black text-slate-900">{formatTaskStatus(data.task.status)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">执行模式</p>
                  <p className="mt-2 text-base font-black text-slate-900">{formatExecutionMode(data.task.executionMode)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">推荐角色</p>
                  <p className="mt-2 text-base font-black text-slate-900">{data.task.recommendedAgentRole}</p>
                </div>
              </div>

              <div
                className={`mt-6 rounded-[1.4rem] border px-4 py-4 ${taskStatusMessage?.tone ?? ''}`}
              >
                <p className="text-xs font-black tracking-[0.2em]">{taskStatusMessage?.title}</p>
                <p className="mt-2 text-sm leading-7">{taskStatusMessage?.body}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleExecuteTask()}
                  disabled={submitting || data.task.status === 'completed' || data.task.status === 'waiting_approval'}
                  className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {submitting
                    ? '执行中…'
                      : data.task.executionMode === 'advanced_discussion'
                      ? '运行高级讨论'
                      : '执行任务'}
                </button>
                {data.task.status === 'waiting_approval' && (
                  <Link
                    href="/approvals"
                    className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 transition-all hover:border-amber-300 hover:bg-amber-100"
                  >
                    前往审批
                  </Link>
                )}
                <Link
                  href="/approvals"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
                >
                  查看审批队列
                </Link>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">工作计划</p>
                  {workflowPlan ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-sky-700">
                          {formatExecutionMode(workflowPlan.mode)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-600">
                          {workflowPlan.steps.length} 步骤
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-600">
                          {workflowPlan.synthesisRequired ? '需要综合' : '无需综合'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {workflowPlan.steps.length === 0 && (
                          <p className="text-sm text-slate-500">当前计划还没有拆出步骤。</p>
                        )}
                        {workflowPlan.steps.map((step, index) => (
                          <div key={step.id} className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-900">
                                  {index + 1}. {step.title}
                                </p>
                                {step.description && <p className="mt-1 text-xs leading-6 text-slate-600">{step.description}</p>}
                              </div>
                              <span className="text-[10px] font-black tracking-[0.16em] text-slate-500">
                                {formatWorkflowStepStatus(step.status)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                              {step.assignmentRole && (
                                <span className="rounded-full bg-slate-100 px-2 py-1">{step.assignmentRole}</span>
                              )}
                              {step.assignmentId && <span className="rounded-full bg-slate-100 px-2 py-1">{step.assignmentId}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      这个任务还没有生成工作计划，创建或执行后会在这里展示。
                    </p>
                  )}
                </div>

                <div className="rounded-[1.4rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">任务分配</p>
                  {assignments.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {assignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-900">
                                {assignment.agentName || assignment.agentId}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                {assignment.assignmentRole || '未命名角色'}
                              </p>
                            </div>
                            <span className="text-[10px] font-black tracking-[0.16em] text-slate-500">
                              {formatWorkflowStepStatus(assignment.status)}
                            </span>
                          </div>
                          {assignment.resultSummary && (
                            <p className="mt-2 text-xs leading-6 text-slate-600">{assignment.resultSummary}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                            {assignment.startedAt && <span className="rounded-full bg-slate-100 px-2 py-1">开始 {assignment.startedAt}</span>}
                            {assignment.endedAt && <span className="rounded-full bg-slate-100 px-2 py-1">结束 {assignment.endedAt}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      当前没有可展示的任务分配记录，系统会在生成 workflow plan 后补充。
                    </p>
                  )}
                </div>
              </div>

              {latestExecution && (
                <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">最新执行</p>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
                    <p className="text-xs tracking-[0.2em] text-slate-500">{formatExecutionStatus(latestExecution.status)}</p>
                    <p className="leading-relaxed">{latestExecution.outputSummary || '尚未记录执行输出摘要。'}</p>
                    {(latestExecution.assignmentRole || latestExecution.assignmentId || latestExecution.workflowStepId) && (
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                        {latestExecution.assignmentRole && <span className="rounded-full bg-slate-100 px-2 py-1">{latestExecution.assignmentRole}</span>}
                        {latestExecution.assignmentId && <span className="rounded-full bg-slate-100 px-2 py-1">{latestExecution.assignmentId}</span>}
                        {latestExecution.workflowStepId && <span className="rounded-full bg-slate-100 px-2 py-1">{latestExecution.workflowStepId}</span>}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Link href={`/executions/${latestExecution.id}`} className="text-[11px] font-black tracking-[0.2em] text-sky-700 hover:text-sky-900">
                        查看最新执行
                      </Link>
                      {latestExecution.executor && <span className="text-[11px] tracking-[0.2em] text-slate-500">执行器：{latestExecution.executor}</span>}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4">
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

              <div className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] tracking-[0.2em] text-slate-500">执行记录</p>
                <div className="mt-4 space-y-3">
                  {data.executions.length === 0 && <p className="text-sm text-slate-500">当前没有执行记录。</p>}
                  {data.executions.map((execution) => (
                    <div key={execution.id} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfaf5] p-4 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-900">{formatExecutionStatus(execution.status)}</p>
                        <Link href={`/executions/${execution.id}`} className="text-[11px] font-black tracking-[0.18em] text-sky-700 hover:text-sky-900">
                          查看
                        </Link>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{execution.outputSummary || '尚无输出摘要'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">任务事件</p>
                  <button
                    type="button"
                    onClick={() => void refreshEvents()}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black tracking-[0.18em] text-slate-600 hover:border-slate-300 hover:text-slate-950"
                  >
                    刷新
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {eventsLoading && <p className="text-sm text-slate-500">正在加载任务事件…</p>}
                  {eventsError && (
                    <div
                      data-testid="task-events-error-state"
                      className="rounded-[1.1rem] border border-rose-200 bg-rose-50 p-4"
                    >
                      <p className="text-xs font-black tracking-[0.2em] text-rose-700">任务事件加载失败</p>
                      <p className="mt-2 text-sm text-rose-700">{eventsError}</p>
                      <button
                        type="button"
                        onClick={() => void refreshEvents()}
                        className="mt-3 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black tracking-[0.2em] text-rose-700 transition-all hover:border-rose-300 hover:bg-rose-100"
                      >
                        重试事件加载
                      </button>
                    </div>
                  )}
                  {!eventsLoading && !eventsError && events.length === 0 && (
                    <p className="text-sm text-slate-500">当前任务暂无事件记录。</p>
                  )}
                  {events.map((event) => (
                    <div key={`${event.taskEventType}-${event.timestamp}-${event.executionId || event.approvalId || 'task'}`} className="rounded-[1.1rem] border border-slate-200 bg-[#fcfaf5] p-4 text-sm text-slate-700">
                      <p className="font-black text-slate-900">{event.taskEventType}</p>
                      <p className="mt-1 text-sm text-slate-600">{event.message}</p>
                      <p className="mt-1 text-[11px] tracking-[0.16em] text-slate-500">{event.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
