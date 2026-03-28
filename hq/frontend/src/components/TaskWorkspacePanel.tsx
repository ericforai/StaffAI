'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileClock, PlayCircle, ShieldAlert, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { useApprovals } from '../hooks/useApprovals';
import { useApprovalActions } from '../hooks/useApprovalActions';
import { useTaskActions } from '../hooks/useTaskActions';
import type { TaskExecutor } from '../hooks/useTaskActions';
import { useTaskComposer } from '../hooks/useTaskComposer';
import { useTaskDetail } from '../hooks/useTaskDetail';
import type { TaskEventSummary } from '../lib/taskEventProjection';
import type { TaskSummary } from '../types';

interface TaskWorkspacePanelProps {
  tasks: TaskSummary[];
  loading: boolean;
  error: string | null;
  latestSummaryByTaskId: Map<string, TaskEventSummary>;
  latestTaskWorkspaceSummary: TaskEventSummary | null;
  latestApprovalWorkspaceSummary: TaskEventSummary | null;
  latestExecutionWorkspaceSummary: TaskEventSummary | null;
  onRefreshTasks: () => Promise<void> | void;
  onOpenDiscussion: () => void;
}

function formatTaskStatus(status: string) {
  switch (status) {
    case 'created':
      return '待执行';
    case 'waiting_approval':
      return '等待审批';
    case 'completed':
      return '已完成';
    case 'running':
      return '执行中';
    case 'failed':
      return '执行失败';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
}

function formatExecutionMode(mode: string) {
  switch (mode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    case 'advanced_discussion':
      return '高级讨论';
    default:
      return mode;
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

function formatExecutionStatus(status?: string) {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return '成功';
    case 'running':
      return '执行中';
    case 'failed':
      return '失败';
    case 'pending':
      return '待执行';
    default:
      return status || '暂无执行';
  }
}

function getSummaryTone(tone?: TaskEventSummary['tone']) {
  switch (tone) {
    case 'success':
      return 'text-emerald-700';
    case 'warning':
      return 'text-amber-700';
    case 'danger':
      return 'text-rose-700';
    case 'info':
      return 'text-sky-700';
    default:
      return 'text-slate-600';
  }
}

export function TaskWorkspacePanel({
  tasks,
  loading,
  error,
  latestSummaryByTaskId,
  latestTaskWorkspaceSummary,
  latestApprovalWorkspaceSummary,
  latestExecutionWorkspaceSummary,
  onRefreshTasks,
  onOpenDiscussion,
}: TaskWorkspacePanelProps) {
  const { approvals, loading: approvalsLoading, error: approvalsError, reload: reloadApprovals } = useApprovals();
  const {
    approvals: mutableApprovals,
    pendingId,
    error: approvalActionError,
    approveApproval,
    rejectApproval,
  } = useApprovalActions(approvals);
  const {
    title,
    setTitle,
    description,
    setDescription,
    submitting: creatingTask,
    error: createError,
    createTask,
  } = useTaskComposer();
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedExecutor, setSelectedExecutor] = useState<TaskExecutor>('openai');
  const effectiveSelectedTaskId = useMemo(() => {
    if (!tasks.length) {
      return '';
    }

    if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) {
      return selectedTaskId;
    }

    return tasks[0].id;
  }, [selectedTaskId, tasks]);
  const {
    data: selectedTaskDetail,
    loading: detailLoading,
    error: detailError,
    setData: setSelectedTaskDetail,
    reload: reloadTaskDetail,
  } = useTaskDetail(effectiveSelectedTaskId);
  const { executeTask, submitting: executingTask, error: executeError } = useTaskActions(
    effectiveSelectedTaskId,
    setSelectedTaskDetail
  );

  const pendingApprovals = useMemo(
    () => mutableApprovals.filter((approval) => approval.status === 'pending').slice(0, 3),
    [mutableApprovals],
  );
  const selectedTask = selectedTaskDetail?.task || tasks.find((task) => task.id === effectiveSelectedTaskId) || null;
  const selectedTaskSummary = selectedTask ? latestSummaryByTaskId.get(selectedTask.id) ?? null : null;
  const latestExecution =
    selectedTaskDetail?.executions[0] || tasks.find((task) => task.id === effectiveSelectedTaskId)?.latestExecution || null;
  const selectedTaskCanExecute = selectedTask ? selectedTask.canExecute ?? selectedTask.status === 'created' : false;

  async function handleCreateTask() {
    const createdTask = await createTask();
    await onRefreshTasks();
    if (createdTask?.id) {
      setSelectedTaskId(createdTask.id);
    }
  }

  async function handleExecuteSelectedTask() {
    const succeeded = await executeTask(selectedExecutor);
    if (succeeded) {
      await Promise.all([onRefreshTasks(), reloadTaskDetail()]);
    }
  }

  async function handleApprovalDecision(approvalId: string, action: 'approve' | 'reject') {
    if (action === 'approve') {
      await approveApproval(approvalId);
    } else {
      await rejectApproval(approvalId);
    }

    await Promise.all([reloadApprovals(), onRefreshTasks(), selectedTaskId ? reloadTaskDetail() : Promise.resolve()]);
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">Task Console</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">统一任务入口</h3>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-slate-600">
              {tasks.length} TASKS
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="任务标题"
              className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="任务描述"
              className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
            <button
              type="button"
              onClick={() => void handleCreateTask()}
              disabled={creatingTask}
              className="rounded-full border border-[#b8c9d2] bg-[#e9f0f3] px-5 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#9ab0bc] hover:bg-[#dce8ee] disabled:opacity-50"
            >
              {creatingTask ? '创建中…' : '创建任务'}
            </button>
          </div>

          {createError && <p className="mt-3 text-sm text-rose-600">{createError}</p>}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">Task Stream</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">任务主线</h3>
            </div>
            <div className="flex gap-2">
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
              >
                任务工作区
              </Link>
              <Link
                href="/approvals"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
              >
                审批队列
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-slate-500">待执行</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{tasks.filter((task) => task.canExecute).length}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-slate-500">待审批</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{pendingApprovals.length}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-slate-500">工作区态势</p>
              <p className={`mt-2 text-sm font-black ${getSummaryTone(latestTaskWorkspaceSummary?.tone)}`}>
                {latestTaskWorkspaceSummary ? `最新事件：${latestTaskWorkspaceSummary.label} · ${latestTaskWorkspaceSummary.detail}` : '等待新事件'}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loading && <p className="text-sm text-slate-500">正在加载任务…</p>}
            {!loading && tasks.length === 0 && <p className="text-sm text-slate-500">还没有任务，先在上方创建第一条任务。</p>}
            {tasks.slice(0, 5).map((task) => {
              const selected = task.id === effectiveSelectedTaskId;
              const latestSummary = latestSummaryByTaskId.get(task.id);

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full rounded-[1.3rem] border px-4 py-4 text-left transition-all ${
                    selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-black ${selected ? 'text-white' : 'text-slate-900'}`}>{task.title}</p>
                      <p className={`mt-2 text-sm leading-6 ${selected ? 'text-slate-200' : 'text-slate-600'}`}>{task.description}</p>
                    </div>
                    <div className={`text-[10px] font-black tracking-[0.16em] ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {formatTaskStatus(task.status)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em]">
                    <span className={`rounded-full px-2 py-1 ${selected ? 'bg-white/10 text-white' : 'bg-white text-slate-600'}`}>
                      {formatExecutionMode(task.executionMode)}
                    </span>
                    {task.latestApproval && (
                      <span className={`rounded-full px-2 py-1 ${selected ? 'bg-amber-400/15 text-amber-100' : 'bg-amber-50 text-amber-700'}`}>
                        审批 {formatApprovalStatus(task.latestApproval.status)}
                      </span>
                    )}
                    {task.latestExecution && (
                      <span className={`rounded-full px-2 py-1 ${selected ? 'bg-emerald-400/15 text-emerald-100' : 'bg-emerald-50 text-emerald-700'}`}>
                        执行 {formatExecutionStatus(task.latestExecution.status)}
                      </span>
                    )}
                  </div>
                  {latestSummary && (
                    <p className={`mt-3 text-xs leading-5 ${selected ? 'text-slate-200' : getSummaryTone(latestSummary.tone)}`}>
                      最新事件：{latestSummary.detail}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">Execution Control</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">任务与执行控制台</h3>
            </div>
            {selectedTask && (
              <Link
                href={`/tasks/${selectedTask.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
              >
                打开详情
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {!selectedTask && <p className="text-sm text-slate-500">选择左侧任务后，这里会显示统一执行视图。</p>}
          {selectedTask && (
            <div className="space-y-4">
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-900">{selectedTask.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{selectedTask.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black tracking-[0.18em] text-slate-500">{formatTaskStatus(selectedTask.status)}</p>
                    <p className="mt-2 text-[10px] font-black tracking-[0.18em] text-slate-500">{formatExecutionMode(selectedTask.executionMode)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black tracking-[0.16em] text-slate-600">
                    推荐角色 {selectedTask.recommendedAgentRole}
                  </span>
                  {selectedTask.approvalRequired && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-amber-700">
                      需要审批
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-sky-700" />
                    <p className="text-sm font-black text-slate-900">执行动作</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    直接从 HQ 触发任务执行。高级讨论型任务会继续走讨论分支，不会丢失现有路径。
                  </p>
                  <label className="mt-3 block text-[11px] font-black tracking-[0.16em] text-slate-500">
                    执行器
                    <select
                      value={selectedExecutor}
                      onChange={(event) => setSelectedExecutor(event.target.value as TaskExecutor)}
                      className="mt-2 w-full rounded-[0.9rem] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
                    >
                      <option value="openai">OpenAI API</option>
                      <option value="codex">Codex CLI</option>
                      <option value="claude">Claude CLI</option>
                      <option value="deerflow">DeerFlow Engine</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleExecuteSelectedTask()}
                    disabled={executingTask || (!selectedTaskCanExecute && selectedTask.executionMode !== 'advanced_discussion')}
                    className="mt-4 w-full rounded-full border border-[#b8c9d2] bg-[#e9f0f3] px-4 py-3 text-sm font-black text-slate-800 transition-all hover:border-[#9ab0bc] hover:bg-[#dce8ee] disabled:opacity-50"
                  >
                    {executingTask ? '执行中…' : selectedTask.executionMode === 'advanced_discussion' ? '运行高级讨论' : '执行任务'}
                  </button>
                </div>

                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    <p className="text-sm font-black text-slate-900">最新执行</p>
                  </div>
                  {!latestExecution ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">当前还没有执行记录，首次执行后会在这里显示最新摘要。</p>
                  ) : (
                    <>
                      <p className="mt-2 text-[10px] font-black tracking-[0.18em] text-slate-500">
                        {formatExecutionStatus(latestExecution.status)} · {latestExecution.executor || '未知执行器'}
                      </p>
                      <div className="mt-2 prose prose-slate max-w-none text-sm leading-6 text-slate-700">
                        {latestExecution.outputSummary ? <ReactMarkdown>{latestExecution.outputSummary}</ReactMarkdown> : '暂无执行输出摘要。'}
                      </div>
                      <Link
                        href={`/executions/${latestExecution.id}`}
                        className="mt-4 inline-flex items-center gap-2 text-[11px] font-black tracking-[0.16em] text-sky-700 hover:text-sky-900"
                      >
                        查看执行详情
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {(detailLoading || detailError || executeError || selectedTaskSummary) && (
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {detailLoading && <p>正在同步任务详情…</p>}
                  {detailError && <p className="text-rose-600">{detailError}</p>}
                  {executeError && <p className="text-rose-600">{executeError}</p>}
                  {selectedTaskSummary && (
                    <p className={`${getSummaryTone(selectedTaskSummary.tone)} ${detailLoading || detailError || executeError ? 'mt-2' : ''}`}>
                      最新事件：{selectedTaskSummary.label} · {selectedTaskSummary.detail}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">Approval Queue</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">待审批项</h3>
            </div>
            <Link
              href="/approvals"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
            >
              打开审批页
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {(approvalsLoading || approvalsError || approvalActionError) && (
            <div className="mb-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {approvalsLoading && <p>正在加载审批队列…</p>}
              {approvalsError && <p className="text-rose-600">{approvalsError}</p>}
              {approvalActionError && <p className="text-rose-600">{approvalActionError}</p>}
            </div>
          )}

          <div className="space-y-3">
            {pendingApprovals.length === 0 && <p className="text-sm text-slate-500">当前没有待处理审批，这里会自动承接高风险任务。</p>}
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{approval.taskId}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatApprovalStatus(approval.status)} · {approval.requestedBy}</p>
                  </div>
                  <ShieldAlert className="h-4 w-4 text-amber-700" />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApprovalDecision(approval.id, 'approve')}
                    disabled={pendingId === approval.id}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black tracking-[0.16em] text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprovalDecision(approval.id, 'reject')}
                    disabled={pendingId === approval.id}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black tracking-[0.16em] text-rose-700 transition-all hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black tracking-[0.18em] text-slate-500">Workspace Split</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-700" />
                <p className="text-sm font-black text-slate-900">任务主路径</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">创建、审批、执行和结果追踪已经集中到这个工作区里，减少在多个页面间跳转。</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <FileClock className="h-4 w-4 text-amber-700" />
                <p className="text-sm font-black text-slate-900">讨论分支</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">高级讨论仍保留在 `专家协作` 工作区，作为专项讨论入口，而不是默认运营中心。</p>
              <button
                type="button"
                onClick={onOpenDiscussion}
                className="mt-4 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-black tracking-[0.16em] text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100"
              >
                打开专家协作
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-slate-500">审批流摘要</p>
              <p className={`mt-2 text-sm font-black ${getSummaryTone(latestApprovalWorkspaceSummary?.tone)}`}>
                {latestApprovalWorkspaceSummary?.label || '等待审批事件'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{latestApprovalWorkspaceSummary?.detail || '高风险任务进入审批后，这里会同步最新状态。'}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-slate-500">执行流摘要</p>
              <p className={`mt-2 text-sm font-black ${getSummaryTone(latestExecutionWorkspaceSummary?.tone)}`}>
                {latestExecutionWorkspaceSummary?.label || '等待执行事件'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{latestExecutionWorkspaceSummary?.detail || '一旦任务运行完成，这里会展示最新执行结果。'}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
