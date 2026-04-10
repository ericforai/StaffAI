const LS_APPROVALS_OVER_WIZARD = 'staffai-delivery-approvals-over-wizard';
const LS_PINNED_TASK_ID = 'staffai-delivery-pinned-task-id';

export interface DeliveryHeroPrefs {
  /** 高级向导打开时，若存在待审批，是否仍优先展示审批焦点（默认 false = 向导优先） */
  approvalsOverWizard: boolean;
  /** 手动固定的任务 id；空字符串表示未固定 */
  pinnedTaskId: string;
}

export function loadDeliveryHeroPrefs(): DeliveryHeroPrefs {
  if (typeof window === 'undefined') {
    return { approvalsOverWizard: false, pinnedTaskId: '' };
  }
  try {
    const raw = localStorage.getItem(LS_APPROVALS_OVER_WIZARD);
    const pinned = localStorage.getItem(LS_PINNED_TASK_ID) ?? '';
    return {
      approvalsOverWizard: raw === '1' || raw === 'true',
      pinnedTaskId: pinned.trim(),
    };
  } catch {
    return { approvalsOverWizard: false, pinnedTaskId: '' };
  }
}

export function saveApprovalsOverWizard(value: boolean): void {
  try {
    localStorage.setItem(LS_APPROVALS_OVER_WIZARD, value ? '1' : '0');
  } catch {
    /* ignore quota */
  }
}

export function savePinnedTaskId(taskId: string): void {
  try {
    if (!taskId.trim()) {
      localStorage.removeItem(LS_PINNED_TASK_ID);
    } else {
      localStorage.setItem(LS_PINNED_TASK_ID, taskId.trim());
    }
  } catch {
    /* ignore */
  }
}
