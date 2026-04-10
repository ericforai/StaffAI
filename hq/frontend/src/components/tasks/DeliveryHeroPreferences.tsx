'use client';

import { deliveryAnalytics } from '../../lib/delivery-analytics';
import {
  saveApprovalsOverWizard,
  savePinnedTaskId,
  type DeliveryHeroPrefs,
} from '../../lib/delivery-hero-prefs';

interface DeliveryHeroPreferencesProps {
  prefs: DeliveryHeroPrefs;
  onPrefsChange: (next: DeliveryHeroPrefs) => void;
  pinnedTaskTitle?: string | null;
}

export function DeliveryHeroPreferences({
  prefs,
  onPrefsChange,
  pinnedTaskTitle,
}: DeliveryHeroPreferencesProps) {
  const toggleApprovals = () => {
    const next = !prefs.approvalsOverWizard;
    saveApprovalsOverWizard(next);
    onPrefsChange({ ...prefs, approvalsOverWizard: next });
    deliveryAnalytics({
      event: 'hero_prefs_change',
      approvalsOverWizard: next,
    });
  };

  const clearPin = () => {
    savePinnedTaskId('');
    onPrefsChange({ ...prefs, pinnedTaskId: '' });
    deliveryAnalytics({ event: 'hero_pin_clear' });
  };

  return (
    <details
      data-testid="delivery-hero-preferences"
      className="mt-4 rounded-xl border border-slate-200/80 bg-white/60 px-4 py-2 text-xs text-slate-600"
    >
      <summary className="cursor-pointer font-black text-slate-500 hover:text-slate-800">
        焦点设置（本机记住）
      </summary>
      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={prefs.approvalsOverWizard}
            onChange={toggleApprovals}
            className="mt-0.5 rounded border-slate-300"
          />
          <span>
            <span className="font-bold text-slate-800">高级向导时仍优先待审批</span>
            <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
              默认关闭：填需求向导会占满交付主线；开启后，有待批时 Hero 会先引导去审批队列。
            </span>
          </span>
        </label>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          <span className="font-bold text-slate-700">固定任务：</span>
          {prefs.pinnedTaskId ? (
            <>
              {pinnedTaskTitle ? `「${pinnedTaskTitle}」` : prefs.pinnedTaskId}
              <button
                type="button"
                onClick={clearPin}
                className="ml-2 font-black text-rose-600 hover:underline"
              >
                清除固定
              </button>
            </>
          ) : (
            '在任务列表卡片上点击「固定到主线」。'
          )}
        </div>
      </div>
    </details>
  );
}
