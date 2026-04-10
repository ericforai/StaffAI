/**
 * 交付主线 / 向导观测：结构化日志（console + 可接 CustomEvent）。
 * 在 DevTools 过滤 `[StaffAI:delivery]`；或监听 `staffai-delivery-analytics`。
 */

export type DeliveryAnalyticsEvent =
  | 'wizard_step_view'
  | 'wizard_create_intent_attempt'
  | 'wizard_create_intent_success'
  | 'wizard_create_intent_error'
  | 'wizard_clarify_attempt'
  | 'wizard_clarify_success'
  | 'wizard_clarify_error'
  | 'wizard_enter_design'
  | 'wizard_design_confirm_attempt'
  | 'wizard_design_confirm_success'
  | 'wizard_design_confirm_error'
  | 'wizard_enter_plan'
  | 'wizard_create_task_attempt'
  | 'wizard_create_task_success'
  | 'wizard_create_task_error'
  | 'wizard_retry'
  | 'hero_prefs_change'
  | 'hero_pin_set'
  | 'hero_pin_clear';

export interface DeliveryAnalyticsPayload {
  event: DeliveryAnalyticsEvent;
  step?: 1 | 2 | 3;
  hasDraft?: boolean;
  message?: string;
  error?: string;
  retryKind?: string;
  pinnedTaskId?: string;
  approvalsOverWizard?: boolean;
  [key: string]: unknown;
}

export function deliveryAnalytics(payload: DeliveryAnalyticsPayload): void {
  const row = {
    ts: new Date().toISOString(),
    ...payload,
  };

  if (typeof console !== 'undefined' && console.info) {
    console.info('[StaffAI:delivery]', JSON.stringify(row));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('staffai-delivery-analytics', { detail: row }));
  }
}
