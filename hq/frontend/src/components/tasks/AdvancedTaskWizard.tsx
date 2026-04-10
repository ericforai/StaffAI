'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useIntentWizard } from '../../hooks/useIntentWizard';
import { deliveryAnalytics } from '../../lib/delivery-analytics';
import { ClarificationPanel } from '../intent/ClarificationPanel';
import { DesignConfirmPanel } from '../intent/DesignConfirmPanel';
import { PlanPreviewPanel } from '../intent/PlanPreviewPanel';
import { IntentWizardStepRail } from './IntentWizardStepRail';

interface AdvancedTaskWizardProps {
  onTaskCreated: (taskId: string) => void;
  onCancel: () => void;
  onWizardContextChange?: (ctx: { step: 1 | 2 | 3; hasDraft: boolean }) => void;
}

function WizardErrorBanner({
  message,
  onRetry,
  retryLabel,
  hint,
  disabled,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div
      data-testid="intent-wizard-error"
      className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4"
    >
      <p className="text-xs font-black uppercase tracking-wider text-rose-600">出错了</p>
      <p className="mt-2 text-sm text-rose-800">{message}</p>
      {hint ? <p className="mt-2 text-xs text-rose-700">{hint}</p> : null}
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="mt-3 rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {retryLabel}
      </button>
    </div>
  );
}

export function AdvancedTaskWizard({ onTaskCreated, onCancel, onWizardContextChange }: AdvancedTaskWizardProps) {
  const { state, createIntent, sendMessage, sendMessageStream, confirmDesign, createTask, loadIntent } =
    useIntentWizard();
  const searchParams = useSearchParams();
  const intentId = searchParams.get('intentId');
  const [lastRawInput, setLastRawInput] = useState('');
  const [lastClarifyMessage, setLastClarifyMessage] = useState('');
  const prevStepRef = useRef(state.step);
  const lastLoggedErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (intentId && !state.draft && !state.loading) {
      void loadIntent(intentId);
    }
  }, [intentId, loadIntent, state.draft, state.loading]);

  useEffect(() => {
    onWizardContextChange?.({ step: state.step, hasDraft: Boolean(state.draft) });
  }, [state.step, state.draft, onWizardContextChange]);

  const draftId = state.draft?.id;
  useEffect(() => {
    deliveryAnalytics({
      event: 'wizard_step_view',
      step: state.step,
      hasDraft: Boolean(state.draft),
      intentId: draftId,
    });
  }, [state.step, draftId]);

  useEffect(() => {
    const prev = prevStepRef.current;
    if (prev === 1 && state.step === 2) {
      deliveryAnalytics({ event: 'wizard_enter_design', intentId: draftId });
    }
    if (prev === 2 && state.step === 3) {
      deliveryAnalytics({ event: 'wizard_enter_plan', intentId: draftId });
      deliveryAnalytics({ event: 'wizard_design_confirm_success', intentId: draftId });
    }
    prevStepRef.current = state.step;
  }, [state.step, draftId]);

  useEffect(() => {
    if (state.error && state.error !== lastLoggedErrorRef.current) {
      lastLoggedErrorRef.current = state.error;
      const ev =
        state.step === 1
          ? state.draft
            ? 'wizard_clarify_error'
            : 'wizard_create_intent_error'
          : state.step === 2
            ? 'wizard_design_confirm_error'
            : 'wizard_create_task_error';
      deliveryAnalytics({ event: ev, step: state.step, error: state.error, intentId: draftId });
    }
    if (!state.error) {
      lastLoggedErrorRef.current = null;
    }
  }, [state.error, state.step, state.draft, draftId]);

  const handleRetry = useCallback(async () => {
    deliveryAnalytics({
      event: 'wizard_retry',
      step: state.step,
      hasDraft: Boolean(state.draft),
      retryKind:
        state.step === 1
          ? state.draft
            ? 'clarify'
            : 'create_intent'
          : state.step === 2
            ? 'design_confirm'
            : 'create_task',
    });
    if (state.step === 1 && !state.draft && lastRawInput.trim()) {
      await createIntent(lastRawInput.trim());
      return;
    }
    if (state.step === 1 && state.draft) {
      if (lastClarifyMessage.trim()) {
        await sendMessage(lastClarifyMessage.trim());
      }
      return;
    }
    if (state.step === 2) {
      await confirmDesign();
      return;
    }
    if (state.step === 3) {
      deliveryAnalytics({ event: 'wizard_create_task_attempt', intentId: state.draft?.id });
      const taskId = await createTask();
      if (taskId) {
        deliveryAnalytics({ event: 'wizard_create_task_success', taskId, intentId: state.draft?.id });
        onTaskCreated(taskId);
      }
    }
  }, [
    state.step,
    state.draft,
    lastRawInput,
    lastClarifyMessage,
    createIntent,
    sendMessage,
    confirmDesign,
    createTask,
    onTaskCreated,
  ]);

  const clarifyRetryHint =
    state.step === 1 && state.draft && !lastClarifyMessage.trim()
      ? '请先在对话中发送一条消息；若已发送，请重发一次以重试上次请求。'
      : undefined;

  // Step 1: Input + Clarification
  if (state.step === 1 && !state.draft) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <IntentWizardStepRail step={1} />
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">AI 任务向导</h2>
            <p className="text-slate-500 mt-1">用一句话描述你想要构建的内容，AI 将协助你完善任务。</p>
            <p className="mt-2 text-xs font-semibold text-slate-500" data-testid="intent-step-completion-hint">
              完成条件：提交描述并成功创建需求草稿。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-bold text-slate-400 hover:text-slate-600"
          >
            返回简易模式
          </button>
        </div>
        <RawInputForm
          onSubmit={async (raw) => {
            setLastRawInput(raw);
            deliveryAnalytics({ event: 'wizard_create_intent_attempt' });
            const draft = await createIntent(raw);
            if (draft?.id) {
              deliveryAnalytics({ event: 'wizard_create_intent_success', intentId: draft.id });
            }
          }}
          loading={state.loading}
        />
        {state.error ? (
          <WizardErrorBanner
            message={state.error}
            onRetry={() => void handleRetry()}
            retryLabel="重试创建需求"
            disabled={state.loading || !lastRawInput.trim()}
          />
        ) : null}
      </div>
    );
  }

  // Step 1b: Clarification dialogue
  if (state.step === 1 && state.draft) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <IntentWizardStepRail step={1} />
        <h2 className="text-2xl font-black text-slate-900 mb-2">完善你的需求</h2>
        <p className="text-xs font-semibold text-slate-500 mb-6" data-testid="intent-step-completion-hint">
          完成条件：与 AI 对齐需求，直至系统允许进入「确认设计方案」。
        </p>
        <ClarificationPanel
          draft={state.draft}
          onSendMessage={async (message) => {
            deliveryAnalytics({ event: 'wizard_clarify_attempt', intentId: state.draft?.id });
            const data = await sendMessage(message);
            if (data !== null) {
              deliveryAnalytics({ event: 'wizard_clarify_success', intentId: state.draft?.id });
            }
          }}
          onSendMessageStream={(message, onChunk, onDone, onError) => {
            deliveryAnalytics({ event: 'wizard_clarify_attempt', intentId: state.draft?.id });
            return sendMessageStream(message, onChunk, (isComplete, d) => {
              deliveryAnalytics({ event: 'wizard_clarify_success', intentId: state.draft?.id });
              onDone(isComplete, d);
            }, onError);
          }}
          onMessageSent={(message) => setLastClarifyMessage(message)}
          loading={state.loading}
        />
        {state.error ? (
          <WizardErrorBanner
            message={state.error}
            onRetry={() => void handleRetry()}
            retryLabel="重试上次澄清"
            hint={clarifyRetryHint}
            disabled={state.loading || !lastClarifyMessage.trim()}
          />
        ) : null}
      </div>
    );
  }

  // Step 2: Design Confirmation
  if (state.step === 2 && state.draft?.designSummary) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <IntentWizardStepRail step={2} />
        <h2 className="text-2xl font-black text-slate-900 mb-2">确认设计方案</h2>
        <p className="text-xs font-semibold text-slate-500 mb-6" data-testid="intent-step-completion-hint">
          完成条件：确认设计摘要后自动生成实施计划。
        </p>
        <DesignConfirmPanel
          draft={state.draft}
          onConfirm={async (modifications) => {
            deliveryAnalytics({ event: 'wizard_design_confirm_attempt', intentId: state.draft?.id });
            await confirmDesign(modifications);
          }}
          loading={state.loading}
        />
        {state.error ? (
          <WizardErrorBanner
            message={state.error}
            onRetry={() => void handleRetry()}
            retryLabel="重试确认与生成计划"
            disabled={state.loading}
          />
        ) : null}
      </div>
    );
  }

  // Step 3: Plan Preview
  if (state.step === 3 && state.draft?.implementationPlan) {
    return (
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-8 shadow-sm">
        <IntentWizardStepRail step={3} />
        <h2 className="text-2xl font-black text-slate-900 mb-2">实施计划预览</h2>
        <p className="text-xs font-semibold text-slate-500 mb-6" data-testid="intent-step-completion-hint">
          完成条件：确认计划并创建正式任务。
        </p>
        <PlanPreviewPanel
          draft={state.draft}
          onCreateTask={async () => {
            deliveryAnalytics({ event: 'wizard_create_task_attempt', intentId: state.draft?.id });
            const taskId = await createTask();
            if (taskId) {
              deliveryAnalytics({ event: 'wizard_create_task_success', taskId, intentId: state.draft?.id });
              onTaskCreated(taskId);
            }
          }}
          loading={state.loading}
        />
        {state.error ? (
          <WizardErrorBanner
            message={state.error}
            onRetry={() => void handleRetry()}
            retryLabel="重试创建任务"
            disabled={state.loading}
          />
        ) : null}
      </div>
    );
  }

  return null;
}

function RawInputForm({ onSubmit, loading }: { onSubmit: (input: string) => void | Promise<void>; loading: boolean }) {
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
          type="button"
          className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          onClick={() => value.trim() && void onSubmit(value.trim())}
          disabled={loading || !value.trim()}
        >
          {loading ? '正在分析...' : '开始需求对齐'}
        </button>
      </div>
    </div>
  );
}
