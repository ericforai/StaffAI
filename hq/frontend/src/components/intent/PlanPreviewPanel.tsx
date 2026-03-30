'use client';

import type { RequirementDraft } from '@/types/domain';

interface Props {
  draft: RequirementDraft;
}

const AUTONOMY_LABELS: Record<string, { label: string; color: string }> = {
  L0: { label: 'Assist Mode', color: 'bg-gray-600' },
  L1: { label: 'Semi-Auto', color: 'bg-blue-600' },
  L2: { label: 'Guided', color: 'bg-amber-600' },
  L3: { label: 'Autonomous', color: 'bg-emerald-600' },
};

export function PlanPreviewPanel({ draft }: Props) {
  const plan = draft.implementationPlan!;
  const autonomy = AUTONOMY_LABELS[draft.suggestedAutonomyLevel || 'L1'] || AUTONOMY_LABELS.L1;

  return (
    <div className="space-y-6">
      {/* Autonomy Level */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">Autonomy Level</span>
        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${autonomy.color}`}>
          {draft.suggestedAutonomyLevel} — {autonomy.label}
        </span>
      </div>

      {/* Scenario */}
      {draft.suggestedScenario && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
          <p className="text-xs text-gray-500 mb-1">Scenario</p>
          <p className="text-sm text-gray-300">{draft.suggestedScenario}</p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Implementation Steps</h3>
        {plan.steps
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <div key={step.id} className="bg-gray-900 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-xs font-bold text-white">
                  {step.order}
                </span>
                <span className="text-sm font-semibold text-blue-400">{step.role}</span>
              </div>
              <p className="text-sm text-gray-300 ml-9">{step.goal}</p>
              {step.input && (
                <p className="text-xs text-gray-500 ml-9 mt-1">Input: {step.input}</p>
              )}
              {step.verification && (
                <p className="text-xs text-gray-500 ml-9 mt-1">Verify: {step.verification}</p>
              )}
              {step.approvalRequired && (
                <span className="ml-9 mt-2 inline-block text-[10px] px-2 py-0.5 rounded bg-amber-900 text-amber-300">
                  Approval Required
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
