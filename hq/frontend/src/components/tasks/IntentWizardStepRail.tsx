'use client';

interface IntentWizardStepRailProps {
  step: 1 | 2 | 3;
}

const STEPS: { step: 1 | 2 | 3; label: string; sub?: string }[] = [
  { step: 1, label: '需求对齐', sub: '输入与澄清' },
  { step: 2, label: '设计确认', sub: '锁定方案摘要' },
  { step: 3, label: '计划与建任务', sub: '生成计划并落地' },
];

export function IntentWizardStepRail({ step }: IntentWizardStepRailProps) {
  return (
    <nav
      data-testid="intent-wizard-steps"
      aria-label="需求向导进度"
      className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4"
    >
      {STEPS.map((s, index) => {
        const done = step > s.step;
        const active = step === s.step;
        return (
          <div key={s.step} className="flex items-center gap-2">
            {index > 0 ? <span className="text-slate-300 select-none">→</span> : null}
            <div
              className={`rounded-xl border px-3 py-2 text-left transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider opacity-80">
                第 {s.step} 步
              </p>
              <p className="text-sm font-black">{s.label}</p>
              {s.sub ? <p className="text-[10px] font-medium opacity-80">{s.sub}</p> : null}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
