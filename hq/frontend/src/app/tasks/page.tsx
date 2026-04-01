'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTasks } from '../../hooks/useTasks';
import { useTaskEventFeed } from '../../hooks/useTaskEventFeed';
import { useAgents } from '../../hooks/useAgents';
import { API_CONFIG } from '../../utils/constants';
import { TaskComposer } from '../../components/tasks/TaskComposer';
import { AdvancedTaskWizard } from '../../components/tasks/AdvancedTaskWizard';
import { TaskFilter } from '../../components/tasks/TaskFilter';
import { TaskCard } from '../../components/tasks/TaskCard';
import { ExecutionConfirmModal } from '../../components/tasks/ExecutionConfirmModal';
import { Library } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  created: '已创建',
  routed: '待执行',
  queued: '排队中',
  running: '运行中',
  waiting_approval: '待审批',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

function TasksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const initialMode = searchParams.get('mode') === 'advanced' ? 'advanced' : 'simple';
  
  const { tasks, loading, error, setTasks, reload } = useTasks();
  const { latestSummaryByTaskId } = useTaskEventFeed();
  const { agents, activeIds } = useAgents();

  const [viewMode, setViewMode] = useState<'all' | 'active'>(statusFilter ? 'active' : 'all');
  const [creationMode, setCreationMode] = useState<'simple' | 'advanced'>(initialMode);
  const [newTaskId, setNewTaskId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (searchParams.get('mode') === 'advanced') {
      setCreationMode('advanced');
    }
  }, [searchParams]);

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
      router.push(`/tasks/${taskId}`);
    } catch (err) {
      console.error('执行失败:', err);
      setExecuting(false);
    }
  }

  const actionableTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'waiting_approval'),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    if (statusFilter) {
      return tasks.filter((t) => t.status === statusFilter);
    }
    return viewMode === 'active' ? actionableTasks : tasks;
  }, [tasks, statusFilter, viewMode, actionableTasks]);

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      {creationMode === 'simple' ? (
        <TaskComposer
          agents={agents}
          activeIds={activeIds}
          onTaskCreated={(task) => {
            setTasks((current) => [task, ...current]);
            setNewTaskId(task.id);
          }}
          onSwitchToAdvanced={() => setCreationMode('advanced')}
        />
      ) : (
        <AdvancedTaskWizard
          onTaskCreated={(taskId) => {
            router.push(`/tasks/${taskId}`);
          }}
          onCancel={() => setCreationMode('simple')}
        />
      )}

      <div className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
        <TaskFilter
          viewMode={viewMode}
          setViewMode={setViewMode}
          visibleCount={visibleTasks.length}
          totalCount={tasks.length}
        />

        <div className="mb-6 flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/50">
              <Library size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">使用最佳实践</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">从模板库快速启动经过验证的交付路径</p>
            </div>
          </div>
          <Link href="/templates" className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:text-slate-950 active:scale-95">
            进入模板中心
          </Link>
        </div>

        {statusFilter && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              筛选状态: {STATUS_LABELS[statusFilter] ?? statusFilter}
            </span>
            <span className="ml-1 text-slate-400">({visibleTasks.length} 条)</span>
            <Link
              href="/tasks"
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800"
            >
              清除筛选
            </Link>
          </div>
        )}

        {loading && <p className="text-sm text-slate-600">正在加载任务...</p>}

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">任务加载失败</p>
              <p className="mt-2 text-sm text-rose-600">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-lg border border-rose-300 bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-rose-600 transition-all hover:border-rose-400 hover:bg-rose-200"
            >
              重试加载
            </button>
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">暂无任务</p>
            <p className="mt-2 text-sm text-slate-500">还没有任务，先在上方创建第一条任务，或返回指挥台从专家讨论生成任务。</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                刷新任务
              </button>
              <Link
                href="/"
                className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-black tracking-[0.18em] text-slate-800 hover:border-slate-400 hover:bg-slate-200"
              >
                前往指挥台
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              latestSummary={latestSummaryByTaskId.get(task.id)}
            />
          ))}
        </div>
      </div>

      {newTaskId && (
        <ExecutionConfirmModal
          taskId={newTaskId}
          executing={executing}
          onClose={() => setNewTaskId(null)}
          onExecute={executeTask}
        />
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1800px] p-6"><p className="text-sm text-slate-500">加载中...</p></div>}>
      <TasksPageContent />
    </Suspense>
  );
}
