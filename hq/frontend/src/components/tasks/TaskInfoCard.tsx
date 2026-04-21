'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { SuspendedTaskPanel } from '../SuspendedTaskPanel';
import { formatTaskStatus, formatExecutionMode } from '../../utils/formatters';
import type { TaskExecutor } from '../../hooks/useTaskActions';
import type { TaskSummary, TaskExecution } from '../../types';
import { Save } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

interface TaskInfoCardProps {
  task: TaskSummary;
  latestExecution: TaskExecution | null;
  selectedExecutor: TaskExecutor;
  setSelectedExecutor: (executor: TaskExecutor) => void;
  onExecute: () => void;
  onPause?: () => void | Promise<void>;
  submitting: boolean;
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

export function TaskInfoCard({
  task,
  latestExecution,
  selectedExecutor,
  setSelectedExecutor,
  onExecute,
  onPause,
  submitting
}: TaskInfoCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [lastTemplateName, setLastTemplateName] = useState<string | null>(null);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState<string | null>(null);
  const statusMessage = getTaskStatusMessage(task.status, task.executionMode);

  const saveTemplateWithName = async (name: string) => {
    setTemplateSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.id}/save-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setLastTemplateName(null);
        setSaveTemplateModalOpen(false);
        setTemplateSaveSuccess('模板已保存。可在模板中心查看或从模板快速发起任务。');
      } else {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = payload.error || `保存失败（${res.status}）`;
        setTemplateSaveError(msg);
        setLastTemplateName(name);
      }
    } catch (err) {
      setTemplateSaveError(String(err));
      setLastTemplateName(name);
    } finally {
      setIsSaving(false);
    }
  };

  const openSaveTemplateModal = () => {
    setTemplateSaveSuccess(null);
    setTemplateNameDraft((lastTemplateName || `${task.title} 模板`).trim());
    setSaveTemplateModalOpen(true);
  };

  const handleSaveTemplateFromModal = async () => {
    const name = templateNameDraft.trim();
    if (!name) return;
    await saveTemplateWithName(name);
  };

  const handleRetrySaveTemplate = () => {
    if (lastTemplateName) {
      void saveTemplateWithName(lastTemplateName);
    }
  };

  return (
    <section className="rounded-[1.8rem] border border-slate-200 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      {saveTemplateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="save-template-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-template-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 id="save-template-modal-title" className="text-lg font-black text-slate-900">
              保存为模板
            </h3>
            <p className="mt-1 text-sm text-slate-500">将当前任务沉淀为可复用模板，便于一键发起相似交付。</p>
            <label className="mt-4 block text-xs font-black tracking-[0.16em] text-slate-500" htmlFor="save-template-name-input">
              模板名称
            </label>
            <input
              id="save-template-name-input"
              type="text"
              value={templateNameDraft}
              onChange={(e) => setTemplateNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveTemplateFromModal();
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSaveTemplateModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTemplateFromModal()}
                disabled={isSaving || !templateNameDraft.trim()}
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="text-2xl font-black text-slate-950">{task.title}</h2>
      <div className="mt-3 text-sm leading-7 text-slate-600 prose prose-sm prose-slate max-w-none">
        <ReactMarkdown>{task.description}</ReactMarkdown>
      </div>
      
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
          <p className="text-[11px] tracking-[0.2em] text-slate-500">状态</p>
          <p className="mt-2 text-base font-black text-slate-900">{formatTaskStatus(task.status)}</p>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
          <p className="text-[11px] tracking-[0.2em] text-slate-500">执行模式</p>
          <p className="mt-2 text-base font-black text-slate-900">{formatExecutionMode(task.executionMode)}</p>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
          <p className="text-[11px] tracking-[0.2em] text-slate-500">推荐角色</p>
          <p className="mt-2 text-base font-black text-slate-900">{task.recommendedAgentRole}</p>
        </div>
      </div>

      {/* Budget Usage Bar */}
      {latestExecution && (
        <div className="mt-6 rounded-[1.2rem] border border-slate-200 bg-[#fcfaf5] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-[0.2em] text-slate-500">预算使用</p>
            <span className="text-[10px] font-medium text-slate-400">token 消耗统计</span>
          </div>
          <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-300"
              style={{ width: '0%' }}
              title="预算数据暂未可用"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span>已用: 计算中...</span>
            <span>限制: 未设置</span>
          </div>
        </div>
      )}

      <div className={`mt-6 rounded-[1.4rem] border px-4 py-4 ${statusMessage.tone}`}>
        <p className="text-xs font-black tracking-[0.2em]">{statusMessage.title}</p>
        <p className="mt-2 text-sm leading-7">{statusMessage.body}</p>
      </div>

      {task.status === 'waiting_approval' && (
        <div className="mt-4">
          <SuspendedTaskPanel taskId={task.id} />
        </div>
      )}

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
            <option value="gemini">Gemini CLI</option>
            <option value="deerflow">DeerFlow Engine</option>
          </select>
        </label>
        <button
          type="button"
          onClick={onExecute}
          disabled={submitting || task.status === 'completed' || task.status === 'waiting_approval'}
          className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {submitting
            ? '执行中…'
            : task.executionMode === 'advanced_discussion'
            ? '运行高级讨论'
            : '执行任务'}
        </button>
        {onPause && latestExecution?.status === 'running' && (
          <button
            type="button"
            onClick={() => void onPause()}
            disabled={submitting}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-800 transition-all hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            暂停执行
          </button>
        )}
        {task.status === 'waiting_approval' && (
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
        <button
          type="button"
          onClick={openSaveTemplateModal}
          disabled={isSaving}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition-all hover:border-slate-300 hover:text-slate-950 flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={16} />
          {isSaving ? '正在沉淀...' : '保存为模板'}
        </button>
        {templateSaveSuccess ? (
          <div
            data-testid="save-template-success"
            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <p>{templateSaveSuccess}</p>
            <Link
              href="/templates"
              className="mt-2 inline-block text-xs font-black text-emerald-800 underline hover:text-emerald-950"
            >
              打开模板中心
            </Link>
          </div>
        ) : null}
        {templateSaveError ? (
          <div
            data-testid="task-save-template-error"
            className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <p className="font-bold">模板保存失败</p>
            <p className="mt-1 text-xs">{templateSaveError}</p>
            {lastTemplateName ? (
              <button
                type="button"
                onClick={handleRetrySaveTemplate}
                disabled={isSaving}
                className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                使用「{lastTemplateName}」重试
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
