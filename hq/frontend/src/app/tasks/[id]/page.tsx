'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTaskDetail } from '../../../hooks/useTaskDetail';
import { useTaskActions } from '../../../hooks/useTaskActions';
import { useTaskEvents } from '../../../hooks/useTaskEvents';
import { useWebSocket, type WsMessage } from '../../../hooks/useWebSocket';
import type { TaskEvent } from '../../../types';

function getTaskStatusMessage(status: string, executionMode: string) {
  if (status === 'waiting_approval') {
    return {
      tone: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
      title: '任务等待审批',
      body: '这个任务被识别为高风险动作，必须先在审批队列中通过后才能继续执行。',
    };
  }

  if (status === 'completed') {
    return {
      tone: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
      title: '任务已完成',
      body: '当前任务已经执行完成，可以继续查看执行摘要或沿着相关审批/结果继续追踪。',
    };
  }

  if (executionMode === 'advanced_discussion') {
    return {
      tone: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
      title: '高级讨论模式',
      body: '这个任务会走多专家讨论与综合路径，而不是普通单任务执行。',
    };
  }

  return {
    tone: 'border-white/10 bg-white/[0.04] text-slate-200',
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(17,212,185,0.12),transparent_26%),#070b12] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300/80">Task Detail</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white">任务详情</h1>
          </div>
          <Link href="/tasks" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:border-emerald-400/40 hover:text-white">
            返回任务列表
          </Link>
        </div>

        {loading && <p className="text-sm text-slate-400">正在加载任务详情...</p>}
        {error && (
          <div
            data-testid="task-detail-error-state"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-rose-400/30 bg-rose-500/10 p-4"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">任务详情加载失败</p>
              <p className="mt-2 text-sm text-rose-100">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="rounded-full border border-rose-300/50 bg-rose-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-100 transition-all hover:border-rose-300 hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
            >
              {loading ? '重试中...' : '重试加载'}
            </button>
          </div>
        )}
        {actionError && <p className="mb-4 text-sm text-rose-300">{actionError}</p>}
        {!loading && !error && !data && (
          <div
            data-testid="task-detail-empty-state"
            className="rounded-[1.4rem] border border-dashed border-white/15 bg-[#0d1118]/70 p-5"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">任务不存在或暂不可用</p>
            <p className="mt-2 text-sm text-slate-400">请返回任务列表确认任务是否已被清理，或稍后重试加载。</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300 transition-all hover:border-white/25 hover:text-white"
              >
                重试加载
              </button>
              <Link
                href="/tasks"
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100 transition-all hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                返回任务列表
              </Link>
            </div>
          </div>
        )}

        {data && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-black text-white">{data.task.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{data.task.description}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">状态</p>
                  <p className="mt-2 text-sm font-black text-white">{data.task.status}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">执行模式</p>
                  <p className="mt-2 text-sm font-black text-white">{data.task.executionMode}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-[#0d1118]/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">推荐角色</p>
                  <p className="mt-2 text-sm font-black text-white">{data.task.recommendedAgentRole}</p>
                </div>
              </div>

              <div
                className={`mt-6 rounded-[1.4rem] border px-4 py-4 ${getTaskStatusMessage(
                  data.task.status,
                  data.task.executionMode,
                ).tone}`}
              >
                <p className="text-xs font-black uppercase tracking-[0.2em]">{getTaskStatusMessage(data.task.status, data.task.executionMode).title}</p>
                <p className="mt-2 text-sm leading-relaxed">{getTaskStatusMessage(data.task.status, data.task.executionMode).body}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleExecuteTask()}
                  disabled={submitting || data.task.status === 'completed' || data.task.status === 'waiting_approval'}
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 transition-all hover:border-cyan-300 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                >
                  {submitting
                    ? '执行中...'
                    : data.task.executionMode === 'advanced_discussion'
                      ? '运行高级讨论'
                      : '执行任务'}
                </button>
                {data.task.status === 'waiting_approval' && (
                  <Link
                    href="/approvals"
                    className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-100 transition-all hover:border-amber-300 hover:bg-amber-400/20"
                  >
                    前往审批
                  </Link>
                )}
                <Link
                  href="/approvals"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-slate-300 transition-all hover:border-white/20 hover:text-white"
                >
                  查看审批队列
                </Link>
              </div>

              {data.executions.length > 0 && (
                <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">最新执行</p>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{data.executions[0].status}</p>
                    <p className="leading-relaxed">
                      {data.executions[0].outputSummary || '尚未记录执行输出摘要。'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/executions/${data.executions[0].id}`}
                        className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 hover:text-cyan-200"
                      >
                        查看最新执行
                      </Link>
                      {data.executions[0].executor && (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          执行器：{data.executions[0].executor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4">
              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Approvals</p>
                <div className="mt-4 space-y-3">
                  {data.approvals.length === 0 && <p className="text-sm text-slate-500">当前没有审批记录。</p>}
                  {data.approvals.map((approval) => (
                    <div key={approval.id} className="rounded-[1.1rem] border border-white/10 bg-[#0d1118]/85 p-4 text-sm text-slate-300">
                      <p className="font-black text-white">{approval.status}</p>
                      <p className="mt-1 text-xs text-slate-500">{approval.requestedAt}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Executions</p>
                <div className="mt-4 space-y-3">
                  {data.executions.length === 0 && <p className="text-sm text-slate-500">当前没有执行记录。</p>}
                  {data.executions.map((execution) => (
                    <div key={execution.id} className="rounded-[1.1rem] border border-white/10 bg-[#0d1118]/85 p-4 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-white">{execution.status}</p>
                        <Link href={`/executions/${execution.id}`} className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200">
                          查看
                        </Link>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{execution.outputSummary || '尚无输出摘要'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Task Events</p>
                  <button
                    type="button"
                    onClick={() => void refreshEvents()}
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 hover:border-white/20 hover:text-white"
                  >
                    刷新
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {eventsLoading && <p className="text-sm text-slate-500">正在加载任务事件...</p>}
                  {eventsError && (
                    <div
                      data-testid="task-events-error-state"
                      className="rounded-[1.1rem] border border-rose-400/30 bg-rose-500/10 p-4"
                    >
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">任务事件加载失败</p>
                      <p className="mt-2 text-sm text-rose-100">{eventsError}</p>
                      <button
                        type="button"
                        onClick={() => void refreshEvents()}
                        className="mt-3 rounded-full border border-rose-300/40 bg-rose-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-100 transition-all hover:border-rose-300 hover:bg-rose-400/25"
                      >
                        重试事件加载
                      </button>
                    </div>
                  )}
                  {!eventsLoading && !eventsError && events.length === 0 && (
                    <p className="text-sm text-slate-500">当前任务暂无事件记录。</p>
                  )}
                  {events.map((event) => (
                    <div key={`${event.taskEventType}-${event.timestamp}-${event.executionId || event.approvalId || 'task'}`} className="rounded-[1.1rem] border border-white/10 bg-[#0d1118]/85 p-4 text-sm text-slate-300">
                      <p className="font-black text-white">{event.taskEventType}</p>
                      <p className="mt-1 text-xs text-slate-400">{event.message}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{event.timestamp}</p>
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
