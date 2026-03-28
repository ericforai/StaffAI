'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useTaskDetail } from '../../../hooks/useTaskDetail';
import { useTaskActions } from '../../../hooks/useTaskActions';
import type { TaskExecutor } from '../../../hooks/useTaskActions';
import { useTaskEvents } from '../../../hooks/useTaskEvents';
import { useGlobalWebSocket, type WsMessage } from '../../../hooks/useGlobalWebSocket';
import { useAgents } from '../../../hooks/useAgents';
import { useExecutionTrace } from '../../../hooks/useExecutionTrace';
import type { TaskEvent, WorkflowPlanMode } from '../../../types';
import { formatTimestamp } from '../../../utils/dateFormatter';
import { API_CONFIG } from '../../../utils/constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, FileText, AlertCircle, CheckCircle2, Info, Copy, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 图标映射：把字符串名称映射到实际的 Lucide 图标组件
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
};

function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || FileText;
}

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
    case 'routed':
      return '已分配';
    case 'created':
      return '已创建';
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

function formatWorkflowPlanMode(mode: WorkflowPlanMode) {
  switch (mode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
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

function formatAssignmentRole(role?: string) {
  switch (role) {
    case 'primary':
      return '主执行者';
    case 'secondary':
      return '协助者';
    case 'dispatcher':
      return '调度员';
    default:
      return role || '';
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

import { formatExecutor } from '../../../utils/formatters';

/**
 * 清理多余的空行，只保留段落之间的单行空行
 */
function cleanupExtraEmptyLines(text: string): string {
  return text
    .split('\n')
    .reduce((lines: string[], line) => {
      // 移除完全空行的连续重复，最多保留一个
      if (line.trim() === '') {
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.trim() !== '') {
          lines.push('');  // 只保留段落间的单行空行
        }
      } else {
        lines.push(line);
      }
      return lines;
    }, [] as string[])
    .join('\n')
    .trim();
}

/**
 * Parse output summary and extract structured sections
 * 检测 ## 开头的标题，根据关键词分配图标和级别
 */
function parseOutputSummary(summary: string): { title?: string; sections: Array<{ title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' }> } {
  // 先清理多余的空行
  const cleanedSummary = cleanupExtraEmptyLines(summary);
  const lines = cleanedSummary.split('\n');
  const sections: Array<{ title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' }> = [];

  let currentSection: { title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' } | null = null;
  let currentContent: string[] = [];

  // 增强的标题检测：支持多种模式
  function detectSectionLevel(title: string): { iconName: string; level: 'good' | 'warning' | 'error' } {
    const lowerTitle = title.toLowerCase();

    // 错误级别 - 关键词检测
    const errorKeywords = ['🚨', 'critical', '问题', '错误', '失败', 'error', 'failed', 'bug', '缺失', 'missing', 'fix', '修复'];
    for (const keyword of errorKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase()) || title.includes(keyword)) {
        return { iconName: 'AlertCircle', level: 'error' };
      }
    }

    // 警告级别
    const warningKeywords = ['⚠️', 'issues', '建议', '注意', 'warning', '建议改进', '可以改进', '推荐', 'recommend'];
    for (const keyword of warningKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase()) || title.includes(keyword)) {
        return { iconName: 'AlertCircle', level: 'warning' };
      }
    }

    // 成功/正常级别
    const goodKeywords = ['✅', '成功', 'working', '正确', '已完成', '分析', 'analysis', '结果', 'result', '优化', 'optimize'];
    for (const keyword of goodKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase()) || title.includes(keyword)) {
        return { iconName: 'CheckCircle2', level: 'good' };
      }
    }

    // 默认使用 Info 图标
    return { iconName: 'Info', level: 'good' };
  }

  for (const line of lines) {
    // 跳过主标题 (# Title)，只处理 ## 二级标题
    if (line.startsWith('# ') && !line.startsWith('##')) {
      continue;
    }

    // 检测二级标题 (## Title)
    if (line.startsWith('## ')) {
      // 保存当前section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }

      // 解析新标题
      const title = line.slice(3).trim();
      const { iconName, level } = detectSectionLevel(title);

      currentSection = { title, icon: getIconComponent(iconName), content: '', level };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // 保存最后一个section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection);
  }

  // 如果没有检测到任何section，创建一个默认的
  if (sections.length === 0 && summary.trim()) {
    sections.push({
      title: '执行结果',
      icon: FileText,
      content: summary.trim(),
      level: 'good',
    });
  }

  return { sections };
}

/**
 * Render a single section with appropriate styling
 * 可折叠的章节卡片，根据级别显示不同颜色
 */
function OutputSection({ title, icon: Icon, content, level }: { title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const levelStyles = {
    error: 'bg-rose-50 border-rose-300 text-rose-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    good: 'bg-white border-slate-200 text-slate-800',
  };

  const iconBgStyles = {
    error: 'bg-rose-100 text-rose-600',
    warning: 'bg-amber-100 text-amber-600',
    good: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className={`rounded-xl border ${levelStyles[level]} mb-3 overflow-hidden shadow-sm`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-black/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${iconBgStyles[level]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 opacity-50" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-50" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-black/10 bg-white/50 p-4">
          <div className="prose prose-slate prose-sm max-w-3xl text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // 表格样式优化
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full divide-y divide-slate-200 border border-slate-300 rounded-lg overflow-hidden">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-50">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-slate-50">{children}</tr>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-normal">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-sm text-slate-600 whitespace-normal align-top">
                    {children}
                  </td>
                ),
                // 代码块样式
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <code className={`${className} rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800`} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800" {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="my-3 rounded-lg bg-slate-900 p-4 overflow-x-auto">
                    <code className="text-xs font-mono text-slate-100 whitespace-pre-wrap">{children}</code>
                  </pre>
                ),
                // 段落和列表样式 - normal 会折叠多余空白
                p: ({ children }) => (
                  <p className="my-3 leading-7 whitespace-normal">{children}</p>
                ),
                li: ({ children }) => (
                  <li className="my-1 leading-7 whitespace-normal">{children}</li>
                ),
                // 标题样式
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function formatExecutionDisplayId(execution: { displayExecutionId?: string; id: string; startedAt?: string }) {
  if (execution.displayExecutionId && execution.displayExecutionId.trim()) {
    return execution.displayExecutionId;
  }
  // 从 startedAt 提取日期，从 id 提取短 ID
  const date = execution.startedAt ? new Date(execution.startedAt).toISOString().slice(0, 10).replace(/-/g, '') : '000000';
  const shortId = execution.id.slice(0, 8);
  return `${date}—${shortId}`;
}

function formatTraceEventType(type: string) {
  switch (type) {
    case 'execution_started':
      return '任务开始执行';
    case 'execution_completed':
      return '执行完成';
    case 'execution_failed':
      return '执行失败';
    case 'execution_cancelled':
      return '执行取消';
    case 'execution_degraded':
      return '降级执行';
    case 'cost_observed':
      return '成本统计';
    case 'tool_call_logged':
      return '工具调用';
    default:
      return type;
  }
}

function formatTaskEventType(type: string) {
  switch (type) {
    case 'execution_started':
      return '任务开始执行';
    case 'execution_completed':
      return '执行完成';
    case 'execution_failed':
      return '执行失败';
    case 'execution_cancelled':
      return '执行取消';
    case 'execution_degraded':
      return '降级执行';
    case 'cost_observed':
      return '成本统计';
    case 'tool_call_logged':
      return '工具调用';
    case 'TASK_EVENT':
      return '任务事件';
    case 'AGENT_WORKING':
      return '专家工作中';
    case 'AGENT_HIRED':
      return '专家已加入';
    case 'AGENT_FIRED':
      return '专家已移出';
    case 'SQUAD_UPDATED':
      return '阵容已更新';
    case 'CONNECTED':
      return '已连接';
    case 'AGENT_ASSIGNED':
      return '任务已分配';
    case 'AGENT_TASK_COMPLETED':
      return '专家任务完成';
    case 'DISCUSSION_STARTED':
      return '讨论已开始';
    case 'DISCUSSION_COMPLETED':
      return '讨论已完成';
    case 'TOOL_PROGRESS':
      return '执行进度';
    default:
      return type;
  }
}

function formatTraceEventSummary(type: string, summary?: string) {
  if (!summary) {
    return undefined;
  }

  if (summary.startsWith('Execution started:')) {
    return undefined;
  }
  if (summary.startsWith('Execution ')) {
    const match = /^Execution\s+(\w+):\s+(.+)$/.exec(summary);
    if (match && /^[0-9a-f-]{36}$/i.test(match[2])) {
      return undefined;
    }
  }

  if (type === 'cost_observed' && summary.startsWith('Cost observed:')) {
    const match = /Cost observed:\s*(\d+)\s*tokens/.exec(summary);
    if (match) {
      return `本次消耗：${match[1]} tokens`;
    }
  }

  if (type === 'execution_started' || type === 'execution_completed' ||
      type === 'execution_failed' || type === 'execution_cancelled') {
    if (summary.startsWith('开始执行任务：') || summary.startsWith('完成任务：') ||
        summary.startsWith('失败任务：') || summary.startsWith('取消任务：')) {
      return undefined;
    }
  }

  return summary;
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
  const { agents } = useAgents();
  const workflowPlan = data?.workflowPlan ?? data?.task.workflowPlan ?? null;
  const assignments = data?.assignments ?? data?.task.assignments ?? [];
  const latestExecution = data?.executions[0] ?? null;
  const taskStatusMessage = data ? getTaskStatusMessage(data.task.status, data.task.executionMode) : null;

  const [selectedExecutor, setSelectedExecutor] = useState<TaskExecutor>('openai');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(
    data?.executions && data.executions.length > 0 ? data.executions[0].id : null
  );

  // 复制状态
  const [copiedExecutionId, setCopiedExecutionId] = useState<string | null>(null);

  // 复制输出摘要到剪贴板
  async function copyOutputSummary(executionId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedExecutionId(executionId);
      setTimeout(() => setCopiedExecutionId(null), 2000);
    } catch {
      // 降级方案
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
    };
    pushEvent(event);
  }, [pushEvent]);

  const { status: wsStatus } = useGlobalWebSocket({
    onMessage: handleWsMessage,
  });

  async function handleExecuteTask() {
    // 检查是否有缺失的专家
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
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black tracking-[0.16em] text-slate-700">
                  执行器
                  <select
                    value={selectedExecutor}
                    onChange={(event) => setSelectedExecutor(event.target.value as TaskExecutor)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black tracking-[0.16em] text-slate-700 outline-none focus:border-slate-400"
                  >
                    <option value="openai">OpenAI API</option>
                    <option value="codex">Codex CLI</option>
                    <option value="claude">Claude CLI</option>
                    <option value="deerflow">DeerFlow Engine</option>
                  </select>
                </label>
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

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDebugInfo((current) => !current)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950"
                >
                  {showDebugInfo ? '隐藏调试信息' : '显示调试信息'}
                </button>
                {showDebugInfo && (
                  <div className="mt-3 rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4 text-xs leading-6 text-slate-700">
                    <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">调试信息（用于排查执行结果不可见）</p>
                    <p className="mt-2">WebSocket 状态：{wsStatus}</p>
                    <p>任务状态：{formatTaskStatus(data.task.status)}</p>
                    <p>执行模式：{formatExecutionMode(data.task.executionMode)}</p>
                    <p>最近执行 ID：{latestExecution ? formatExecutionDisplayId(latestExecution) : '无'}</p>
                    <p>最近执行器：{latestExecution?.executor || '无'}</p>
                    <p>运行时：{latestExecution?.runtimeName || '无'}</p>
                    <p>降级执行：{latestExecution?.degraded ? '是' : '否'}</p>
                    <p>完成时间：{formatTimestamp(latestExecution?.completedAt)}</p>
                    <p className="mt-2">
                      输出摘要预览：{latestExecution?.outputSummary ? latestExecution.outputSummary.slice(0, 120) : '无'}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-slate-200 bg-[#fcfaf5] p-4">
                  <p className="text-[11px] tracking-[0.2em] text-slate-500">工作计划</p>
                  {workflowPlan ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-sky-700">
                          {formatWorkflowPlanMode(workflowPlan.mode)}
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
                                <span className="rounded-full bg-slate-100 px-2 py-1">{formatAssignmentRole(step.assignmentRole)}</span>
                              )}
                              {/* 不再显示 assignmentId，对用户无意义 */}
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
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] tracking-[0.2em] text-slate-500">任务分配</p>
                    {assignments.length > 0 && (
                      <Link
                        href="/market"
                        className="text-[10px] font-medium text-sky-600 hover:text-sky-700"
                      >
                        + 添加专家
                      </Link>
                    )}
                  </div>
                  {assignments.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {assignments.map((assignment) => {
                        // 检查专家是否真实存在于组织架构中
                        const agentExists = agents.some(a => a.id === assignment.agentId);
                        const isMissingAgent = !agentExists && !assignment.agentName;

                        return (
                          <div
                            key={assignment.id}
                            className={`rounded-[1.1rem] border px-3 py-3 ${
                              isMissingAgent ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-black ${isMissingAgent ? 'text-amber-900' : 'text-slate-900'}`}>
                                    {assignment.agentName || assignment.agentId}
                                  </p>
                                  {isMissingAgent && (
                                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                      未聘用
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-slate-600">
                                  {assignment.assignmentRole || '未命名角色'}
                                </p>
                                {isMissingAgent && (
                                  <div className="mt-2 rounded-md bg-amber-100 px-3 py-2">
                                    <div className="flex items-center gap-2 text-amber-800">
                                      <AlertCircle className="h-4 w-4" />
                                      <p className="text-xs font-medium">组织中没有此类型专家，请先去人才市场聘用</p>
                                    </div>
                                    <Link
                                      href="/market"
                                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800"
                                    >
                                      前往人才市场 →
                                    </Link>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-black tracking-[0.16em] text-slate-500">
                                {formatWorkflowStepStatus(assignment.status)}
                              </span>
                            </div>
                            {assignment.resultSummary && !isMissingAgent && (
                              <p className="mt-2 text-xs leading-6 text-slate-600">{assignment.resultSummary}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                              {assignment.startedAt && <span className="rounded-full bg-slate-100 px-2 py-1">开始 {formatTimestamp(assignment.startedAt)}</span>}
                              {assignment.endedAt && <span className="rounded-full bg-slate-100 px-2 py-1">结束 {formatTimestamp(assignment.endedAt)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      当前没有可展示的任务分配记录，系统会在生成 workflow plan 后补充。
                    </p>
                  )}
                </div>
              </div>

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
                <div className="mt-4 space-y-2">
                  {data.executions.length === 0 && <p className="text-sm text-slate-500">当前没有执行记录。</p>}
                  {data.executions.map((execution, index) => {
                    const isLatest = index === 0;
                    const isExpanded = expandedExecutionId === execution.id;
                    return (
                      <div key={execution.id} className={`rounded-[1.1rem] border overflow-hidden ${isExpanded ? 'border-slate-300 bg-white' : 'border-slate-200 bg-[#fcfaf5]'}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedExecutionId(isExpanded ? null : execution.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {isLatest && <span className="text-[10px] text-slate-400">最新</span>}
                            <span className="text-[10px] font-black tracking-[0.12em] text-slate-500">
                              {formatExecutionDisplayId(execution)}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-[0.16em] ${
                              execution.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              execution.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {formatExecutionStatus(execution.status)}
                            </span>
                            <span className="text-xs text-slate-500">{formatTimestamp(execution.startedAt)}</span>
                            {execution.executor && <span className="text-xs text-slate-500">{formatExecutor(execution.executor)}</span>}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-200 p-3 space-y-4">
                            {/* 输出摘要 */}
                            {execution.outputSummary && (
                              <div>
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] tracking-[0.16em] text-slate-500">输出摘要</p>
                                  <button
                                    type="button"
                                    onClick={() => copyOutputSummary(execution.id, execution.outputSummary ?? '')}
                                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                    title="复制输出摘要"
                                  >
                                    {copiedExecutionId === execution.id ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="text-emerald-600">已复制</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5" />
                                        <span>复制</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <div className="mt-2 space-y-3">
                                  {(() => {
                                    const { sections } = parseOutputSummary(execution.outputSummary);
                                    if (sections.length > 0) {
                                      // 有结构化的章节，使用卡片式展示
                                      return sections.map((section) => (
                                        <OutputSection
                                          key={section.title}
                                          title={section.title}
                                          icon={section.icon}
                                          content={section.content}
                                          level={section.level}
                                        />
                                      ));
                                    } else {
                                      // 无明确结构，使用默认 prose 渲染
                                      return (
                                        <div className="prose prose-slate prose-sm max-w-3xl text-sm text-slate-700">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                              table: ({ children }) => (
                                                <div className="overflow-x-auto my-3">
                                                  <table className="min-w-full divide-y divide-slate-200 border border-slate-300 rounded-lg overflow-hidden">
                                                    {children}
                                                  </table>
                                                </div>
                                              ),
                                              thead: ({ children }) => (
                                                <thead className="bg-slate-50">{children}</thead>
                                              ),
                                              tbody: ({ children }) => (
                                                <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
                                              ),
                                              th: ({ children }) => (
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-normal">
                                                  {children}
                                                </th>
                                              ),
                                              td: ({ children }) => (
                                                <td className="px-3 py-2 text-sm text-slate-600 whitespace-normal align-top">
                                                  {children}
                                                </td>
                                              ),
                                              p: ({ children }) => (
                                                <p className="my-3 leading-7 whitespace-normal">{children}</p>
                                              ),
                                              li: ({ children }) => (
                                                <li className="my-1 leading-7 whitespace-normal">{children}</li>
                                              ),
                                            }}
                                          >
                                            {execution.outputSummary}
                                          </ReactMarkdown>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            )}

                            {/* 错误信息 */}
                            {execution.errorMessage && (
                              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 p-3">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-rose-400">失败原因</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-rose-700">{execution.errorMessage}</p>
                              </div>
                            )}

                            {/* 工具调用 */}
                            {execution.toolCalls && execution.toolCalls.length > 0 && (
                              <div>
                                <p className="text-[11px] tracking-[0.16em] text-slate-500">工具调用</p>
                                <div className="mt-3 space-y-2">
                                  {execution.toolCalls.map((toolCall: any) => (
                                    <div key={toolCall.id} className="rounded-[1rem] border border-slate-200 bg-white p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-black text-slate-900">{toolCall.toolName}</p>
                                          <p className="mt-1 text-xs text-slate-500">{toolCall.actorRole || '未知角色'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-black tracking-[0.16em] text-slate-500">
                                          <span className="rounded-full bg-slate-100 px-2 py-1">
                                            {toolCall.status === 'completed' ? '已完成' :
                                             toolCall.status === 'failed' ? '失败' :
                                             toolCall.status === 'running' ? '进行中' : toolCall.status}
                                          </span>
                                          {toolCall.riskLevel && (
                                            <span className="rounded-full bg-slate-100 px-2 py-1">
                                              {toolCall.riskLevel === 'high' ? '高风险' :
                                               toolCall.riskLevel === 'medium' ? '中风险' :
                                               toolCall.riskLevel === 'low' ? '低风险' : toolCall.riskLevel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {toolCall.inputSummary && (
                                        <div className="mt-2 text-xs text-slate-600">
                                          <span className="font-black">输入：</span>{toolCall.inputSummary}
                                        </div>
                                      )}
                                      {toolCall.outputSummary && (
                                        <div className="mt-2 prose prose-slate prose-xs max-w-3xl text-slate-600">
                                          <span className="font-black">输出：</span>
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{toolCall.outputSummary}</ReactMarkdown>
                                        </div>
                                      )}
                                      {(toolCall.timestamp || toolCall.createdAt) && (
                                        <p className="mt-2 text-[11px] text-slate-400">
                                          {formatTimestamp(toolCall.timestamp || toolCall.createdAt)}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 执行流程记录 */}
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] tracking-[0.16em] text-slate-500">执行流程记录</p>
                                <button
                                  type="button"
                                  onClick={() => void reloadTrace()}
                                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black tracking-[0.2em] text-slate-600 hover:border-slate-300 hover:text-slate-950"
                                >
                                  刷新
                                </button>
                              </div>
                              {traceLoading && <p className="mt-2 text-sm text-slate-600">正在加载流程记录…</p>}
                              {traceError && <p className="mt-2 text-sm text-rose-600">{traceError}</p>}
                              {!traceLoading && !traceError && (!trace || trace.traceEvents?.length === 0) && (
                                <p className="mt-2 text-sm text-slate-500">暂无流程记录。</p>
                              )}
                              {trace && trace.traceEvents && trace.traceEvents.length > 0 && (
                                <ul className="mt-3 space-y-2">
                                  {trace.traceEvents.slice(0, 20).map((event) => {
                                    const summaryText = formatTraceEventSummary(event.type, event.summary);
                                    const eventTime = new Date(event.occurredAt).getTime();
                                    const deltaMs = Date.now() - eventTime;
                                    let timeDisplay = formatTimestamp(event.occurredAt);
                                    if (deltaMs > 0 && deltaMs < 60_000) {
                                      timeDisplay += '（刚刚）';
                                    } else if (deltaMs >= 60_000 && deltaMs < 3600_000) {
                                      timeDisplay += `（${Math.floor(deltaMs / 60_000)}分钟前）`;
                                    } else if (deltaMs >= 3600_000 && deltaMs < 86400_000) {
                                      timeDisplay += `（${Math.floor(deltaMs / 3600_000)}小时前）`;
                                    }
                                    return (
                                      <li key={event.id} className="rounded-[0.8rem] border border-slate-200 bg-white p-2">
                                        <p className="text-xs font-black text-slate-800">{formatTraceEventType(event.type)}</p>
                                        <p className="mt-1 text-[10px] text-slate-500">{timeDisplay}</p>
                                        {summaryText && <p className="mt-1 text-xs text-slate-700">{summaryText}</p>}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>

                            {/* 控制按钮 */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => fetch(`${API_CONFIG.BASE_URL}/executions/${execution.id}/pause`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'X-Agency-Control': '1' },
                                }).then(() => reload()).catch(() => reload())}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              >
                                暂停
                              </button>
                              <button
                                type="button"
                                onClick={() => fetch(`${API_CONFIG.BASE_URL}/executions/${execution.id}/resume`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'X-Agency-Control': '1' },
                                }).then(() => reload()).catch(() => reload())}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                              >
                                恢复
                              </button>
                              <button
                                type="button"
                                onClick={() => fetch(`${API_CONFIG.BASE_URL}/executions/${execution.id}/cancel`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'X-Agency-Control': '1' },
                                }).then(() => reload()).catch(() => reload())}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                      <p className="font-black text-slate-900">{formatTaskEventType(event.taskEventType)}</p>
                      <p className="mt-1 text-sm text-slate-600">{event.message}</p>
                      <p className="mt-1 text-[11px] tracking-[0.16em] text-slate-500">{formatTimestamp(event.timestamp)}</p>
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
