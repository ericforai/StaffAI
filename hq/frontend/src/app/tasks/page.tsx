'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useTaskComposer } from '../../hooks/useTaskComposer';
import { useTaskEventFeed } from '../../hooks/useTaskEventFeed';
import { useAgents } from '../../hooks/useAgents';
import { API_CONFIG, DEPT_MAP } from '../../utils/constants';

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
    case 'pending':
      return '待开始';
    case 'routed':
      return '已分配';
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
    case 'auto':
      return '自动';
    default:
      return mode;
  }
}

export default function TasksPage() {
  const router = useRouter();
  const { tasks, loading, error, setTasks, reload } = useTasks();
  const { latestSummaryByTaskId } = useTaskEventFeed();
  const { agents, activeIds } = useAgents();
  const { title, setTitle, description, setDescription, assigneeId, setAssigneeId, assigneeName, setAssigneeName, priority, setPriority, submitting, error: composeError, createTask } = useTaskComposer((task) =>
    setTasks((current) => [task, ...current])
  );
  const [viewMode, setViewMode] = useState<'all' | 'active'>('all');

  // 负责人选择状态
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // 切换部门展开/收起
  function toggleDepartment(dept: string) {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dept)) {
        newSet.delete(dept);
      } else {
        newSet.add(dept);
      }
      return newSet;
    });
  }

  // 按部门分组活跃员工
  const agentsByDepartment = useMemo(() => {
    const grouped: Record<string, typeof agents> = {};
    agents
      .filter(agent => activeIds.includes(agent.id))
      .forEach(agent => {
        const dept = agent.department || 'specialized';
        if (!grouped[dept]) {
          grouped[dept] = [];
        }
        grouped[dept].push(agent);
      });
    return grouped;
  }, [agents, activeIds]);

  // 新创建任务后的执行确认状态
  const [newTaskId, setNewTaskId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  // 执行任务
  async function executeTask(taskId: string) {
    setExecuting(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/tasks/${taskId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executor: 'claude',
          summary: '从任务列表快速执行',
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || '任务执行失败');
      }
      // 执行成功后跳转到详情页
      router.push(`/tasks/${taskId}`);
    } catch (err) {
      console.error('执行失败:', err);
      setExecuting(false);
    }
  }

  // 创建任务后的处理
  async function handleCreateTask() {
    const result = await createTask();
    if (result) {
      setNewTaskId(result.id);
    }
  }

  // 关闭确认弹窗
  function closeConfirmModal() {
    setNewTaskId(null);
  }

  const actionableTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'waiting_approval'),
    [tasks],
  );
  const visibleTasks = viewMode === 'active' ? actionableTasks : tasks;

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">新建任务</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">发起新任务</h2>
          </div>
          <p className="text-xs tracking-[0.18em] text-slate-500">任务入口</p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="任务标题"
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="任务描述"
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => void handleCreateTask()}
            disabled={submitting || !assigneeId}
            className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {submitting ? '创建中...' : '创建任务'}
          </button>
        </div>

        {/* 负责人选择 - 部门-人员二级结构 */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-700 mb-2">
            负责人 <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
              className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-base text-left transition-colors ${
                assigneeDropdownOpen ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={assigneeId ? 'text-slate-800' : 'text-slate-400'}>
                {assigneeName || '请选择负责人'}
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${assigneeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {assigneeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                {Object.keys(agentsByDepartment).length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-slate-500">暂无可用员工</p>
                    <Link
                      href="/organization"
                      className="mt-2 inline-block text-xs font-medium text-sky-600 hover:text-sky-700"
                      onClick={() => setAssigneeDropdownOpen(false)}
                    >
                      前往组织架构 →
                    </Link>
                  </div>
                ) : (
                  Object.entries(agentsByDepartment).map(([dept, deptAgents]) => {
                    const deptInfo = DEPT_MAP[dept];
                    const DeptIcon = deptInfo?.icon;
                    const isExpanded = expandedDepartments.has(dept);
                    return (
                      <div key={dept} className="border-b border-slate-100 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => toggleDepartment(dept)}
                          className="flex w-full items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {DeptIcon && <DeptIcon className={`h-4 w-4 ${deptInfo?.color}`} />}
                            <span className="text-xs font-semibold text-slate-700">{deptInfo?.label || dept}</span>
                            <span className="text-xs text-slate-400">({deptAgents.length})</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="border-t border-slate-100">
                            {deptAgents.map(agent => (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => {
                                  setAssigneeId(agent.id);
                                  setAssigneeName(agent.frontmatter?.name || '');
                                  setAssigneeDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sky-50 transition-colors ${
                                  assigneeId === agent.id ? 'bg-sky-100 text-sky-700' : 'text-slate-600'
                                }`}
                              >
                                <span className="text-sm">{agent.frontmatter?.name}</span>
                                <span className="ml-auto text-xs text-slate-400">{agent.frontmatter?.emoji}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {!assigneeId && (
            <p className="mt-1.5 text-xs text-rose-500">请先选择负责人</p>
          )}
        </div>

        {/* 优先级选择 */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-700 mb-2">
            优先级
          </label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high' | 'urgent')}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none"
          >
            <option value="low">低优先级</option>
            <option value="medium">中优先级</option>
            <option value="high">高优先级</option>
            <option value="urgent">紧急</option>
          </select>
        </div>

        {composeError && <p className="mt-3 text-sm text-rose-500">{composeError}</p>}
      </div>

      <div className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
              viewMode === 'all'
                ? 'border-slate-400 bg-slate-100 text-slate-900'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            全部任务
          </button>
          <button
            type="button"
            onClick={() => setViewMode('active')}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
              viewMode === 'active'
                ? 'border-slate-400 bg-slate-100 text-slate-900'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            待执行
          </button>
          <p className="text-xs text-slate-400">
            显示 {visibleTasks.length} / {tasks.length} 条任务
          </p>
        </div>

        {loading && <p className="text-sm text-slate-600">正在加载任务...</p>}
        {error && (
          <div
            data-testid="tasks-error-state"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">任务加载失败</p>
              <p className="mt-2 text-sm text-rose-600">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="rounded-lg border border-rose-300 bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-600 transition-all hover:border-rose-400 hover:bg-rose-200 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {loading ? '重试中...' : '重试加载'}
            </button>
          </div>
        )}
        {!loading && !error && tasks.length === 0 && (
          <div
            data-testid="tasks-empty-state"
            className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">暂无任务</p>
            <p className="mt-2 text-sm text-slate-500">还没有任务，先在上方创建第一条任务，或返回指挥台从专家讨论生成任务。</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
              >
                刷新任务
              </button>
              <Link
                href="/"
                className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200"
              >
                前往指挥台
              </Link>
            </div>
          </div>
        )}
        {!loading && !error && tasks.length > 0 && visibleTasks.length === 0 && (
          <div
            data-testid="tasks-filter-empty-state"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-sm text-slate-500">
              当前筛选没有可执行任务，切换回 <span className="font-black text-slate-900">全部任务</span> 查看其他项。
            </p>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 transition-all hover:border-slate-300 hover:text-slate-900"
            >
              查看全部
            </button>
          </div>
        )}

        <div className="grid gap-4">
          {visibleTasks.map((task) => {
            const latestSummary = latestSummaryByTaskId.get(task.id);
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="rounded-lg border border-slate-200 bg-white px-5 py-4 transition-all hover:border-slate-400 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {task.assigneeName && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                          {task.assigneeName}
                        </span>
                      )}
                      {latestSummary && (
                        <span className="text-xs text-slate-500">
                          最新事件：{latestSummary.detail}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.2em] text-slate-500">
                    <p>{formatTaskStatus(task.status)}</p>
                    <p className="mt-2">{formatExecutionMode(task.executionMode)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 创建成功后的确认弹窗 */}
      {newTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">任务创建成功！</h3>
              <p className="mt-2 text-sm text-slate-600">任务已添加到队列，你可以立即执行或稍后在详情页启动。</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                稍后执行
              </button>
              <button
                type="button"
                onClick={() => executeTask(newTaskId)}
                disabled={executing}
                className="flex-1 rounded-lg border border-sky-500 bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {executing ? '执行中...' : '立即执行'}
              </button>
            </div>

            <div className="mt-4 text-center">
              <Link
                href={`/tasks/${newTaskId}`}
                onClick={closeConfirmModal}
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                查看任务详情
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
