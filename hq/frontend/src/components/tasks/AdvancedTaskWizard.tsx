'use client';

import { useState } from 'react';
import { useIntentWizard } from '../../hooks/useIntentWizard';
import { ClarificationPanel } from '../intent/ClarificationPanel';
import { DesignConfirmPanel } from '../intent/DesignConfirmPanel';
import { PlanPreviewPanel } from '../intent/PlanPreviewPanel';

interface AdvancedTaskWizardProps {
  onTaskCreated: (taskId: string) => void;
  onCancel: () => void;
}

export function AdvancedTaskWizard({ onTaskCreated, onCancel }: AdvancedTaskWizardProps) {
  const { state, createIntent, sendMessage, confirmDesign, createTask } = useIntentWizard();

  // Step 1: Input + Clarification
  if (state.step === 1 && !state.draft) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">AI 任务向导</h2>
            <p className="text-slate-500 mt-1">用一句话描述你想要构建的内容，AI 将协助你完善任务。</p>
          </div>
          <button 
            onClick={onCancel}
            className="text-sm font-bold text-slate-400 hover:text-slate-600"
          >
            返回简易模式
          </button>
        </div>
        <RawInputForm onSubmit={createIntent} loading={state.loading} />
        {state.error && <p className="mt-4 text-sm text-rose-500">{state.error}</p>}
      </div>
    );
  }

  // Step 1b: Clarification dialogue
  if (state.step === 1 && state.draft) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 mb-6">完善你的需求</h2>
        <ClarificationPanel
          draft={state.draft}
          onSendMessage={sendMessage}
          loading={state.loading}
        />
        {state.error && <p className="mt-4 text-sm text-rose-500">{state.error}</p>}
      </div>
    );
  }

  // Step 2: Design Confirmation
  if (state.step === 2 && state.draft?.designSummary) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 mb-6">确认设计方案</h2>
        <DesignConfirmPanel
          draft={state.draft}
          onConfirm={confirmDesign}
          loading={state.loading}
        />
        {state.error && <p className="mt-4 text-sm text-rose-500">{state.error}</p>}
      </div>
    );
  }

  // Step 3: Plan Preview
  if (state.step === 3 && state.draft?.implementationPlan) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 mb-6">实施计划预览</h2>
        <PlanPreviewPanel 
          draft={state.draft} 
          onCreateTask={async () => {
            const taskId = await createTask();
            if (taskId) {
              onTaskCreated(taskId);
            }
          }}
          loading={state.loading}
        />
        {state.error && <p className="mt-4 text-sm text-rose-500">{state.error}</p>}
      </div>
    );
  }

  return null;
}

function RawInputForm({ onSubmit, loading }: { onSubmit: (input: string) => void; loading: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div className="space-y-4">
      <textarea
        className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none transition-all"
        placeholder="例如：我想要添加一个具有自主级别和计划预览的任务创建向导..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      <div className="flex justify-end">
        <button
          className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={loading || !value.trim()}
        >
          {loading ? '正在分析...' : '开始需求对齐'}
        </button>
      </div>
    </div>
  );
}
