'use client';

import type { RequirementDraft } from '@/types/domain';

interface Props {
  draft: RequirementDraft;
  onCreateTask: () => void;
  onBack?: () => void;
  loading: boolean;
}

const AUTONOMY_LABELS: Record<string, { label: string; color: string }> = {
  L0: { label: '辅助模式', color: 'bg-gray-600' },
  L1: { label: '半自动', color: 'bg-blue-600' },
  L2: { label: '引导式', color: 'bg-amber-600' },
  L3: { label: '全自动', color: 'bg-emerald-600' },
};

export function PlanPreviewPanel({ draft, onCreateTask, onBack, loading }: Props) {
  const plan = draft.implementationPlan!;
  const autonomy = AUTONOMY_LABELS[draft.suggestedAutonomyLevel || 'L1'] || AUTONOMY_LABELS.L1;

  return (
    <div className="space-y-6">
      {/* Autonomy Level */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">自主等级</span>
        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${autonomy.color}`}>
          {draft.suggestedAutonomyLevel} — {autonomy.label}
        </span>
      </div>

      {/* Scenario */}
      {draft.suggestedScenario && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <p className="text-xs text-gray-500 mb-1">场景</p>
          <p className="text-sm text-gray-300 font-semibold">{draft.suggestedScenario}</p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">实施步骤</h3>
        {plan.steps
          .sort((a: any, b: any) => a.order - b.order)
          .map((step: any) => (
            <div key={step.id} className="bg-gray-900 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-xs font-bold text-white">
                  {step.order}
                </span>
                <span className="text-sm font-semibold text-blue-400 uppercase">{step.role}</span>
              </div>
              <p className="text-sm text-gray-300 ml-9">{step.goal}</p>
              <div className="ml-9 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {step.input && (
                  <p className="text-[11px] text-gray-500">
                    <span className="font-semibold">输入:</span> {step.input}
                  </p>
                )}
                {step.verification && (
                  <p className="text-[11px] text-gray-500">
                    <span className="font-semibold">验证:</span> {step.verification}
                  </p>
                )}
              </div>
              {step.approvalRequired && (
                <span className="ml-9 mt-2 inline-block text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/50">
                  需要人工审批
                </span>
              )}
            </div>
          ))}
      </div>

      {/* Action Button */}
      <div className="mt-8 pt-6 border-t border-gray-800">
        <div className="flex gap-3 mb-4">
          {onBack && (
            <button
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
              onClick={onBack}
            >
              ← 上一步
            </button>
          )}
        </div>
        <button
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={onCreateTask}
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在启动团队...
            </>
          ) : (
            '确认并开始实施'
          )}
        </button>
        <p className="text-center text-xs text-gray-500 mt-4">
          这将创建一个正式的任务记录并激活多智能体团队。
        </p>
      </div>
    </div>
  );
}
