'use client';

import { AgentSelector } from './AgentSelector';
import { useTaskComposer } from '../../hooks/useTaskComposer';
import type { Agent, TaskSummary } from '../../types';

interface TaskComposerProps {
  agents: Agent[];
  activeIds: string[];
  onTaskCreated: (task: TaskSummary) => void;
}

export function TaskComposer({ agents, activeIds, onTaskCreated }: TaskComposerProps) {
  const {
    title,
    setTitle,
    description,
    setDescription,
    assigneeId,
    setAssigneeId,
    assigneeName,
    setAssigneeName,
    priority,
    setPriority,
    submitting,
    error,
    createTask
  } = useTaskComposer(onTaskCreated);

  return (
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
          onClick={() => void createTask()}
          disabled={submitting || !assigneeId}
          className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {submitting ? '创建中...' : '创建任务'}
        </button>
      </div>

      {/* 负责人选择 - 部门-人员二级结构 */}
      <AgentSelector 
        agents={agents}
        activeIds={activeIds}
        selectedId={assigneeId}
        selectedName={assigneeName}
        onSelect={(id, name) => {
          setAssigneeId(id);
          setAssigneeName(name);
        }}
        error={!!error}
      />

      {/* 优先级选择 */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700 mb-2">
          优先级
        </label>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as any)}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none"
        >
          <option value="low">低优先级</option>
          <option value="medium">中优先级</option>
          <option value="high">高优先级</option>
          <option value="urgent">紧急</option>
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
    </div>
  );
}
