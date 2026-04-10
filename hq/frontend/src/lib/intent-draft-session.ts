/** S0：简易 ↔ 高级切换时保留未完成 intent（与 AdvancedTaskWizard 一致） */
export const INTENT_DRAFT_SESSION_KEY = 'staffai-intent-draft-id';

export function clearIntentDraftSession(): void {
  try {
    sessionStorage.removeItem(INTENT_DRAFT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
