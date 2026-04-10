import type { Task } from '../types/domain';

/** Minimal approval shape for focus derivation */
export interface PendingApprovalLite {
  taskId: string;
  status: string;
}

/** Wizard progress reported by AdvancedTaskWizard (for /tasks hero). */
export interface WizardContext {
  step: 1 | 2 | 3;
  hasDraft: boolean;
}

export interface DeliveryHeroDerivationPrefs {
  /** 高级向导时，待审批是否压过向导（默认 false） */
  approvalsOverWizard: boolean;
  /** 固定到主线的任务 id */
  pinnedTaskId: string;
}

export interface DeliveryFocus {
  kind:
    | 'wizard'
    | 'approval_queue'
    | 'task_running'
    | 'task_waiting_approval'
    | 'task_continue'
    | 'idle';
  /** One-line “what you’re doing now” */
  currentLabel: string;
  /** Optional hint for completion criteria */
  completionHint?: string;
  primaryCta: { label: string; href?: string; hash?: string };
  /** Human-readable blocker; null if none */
  blocker: string | null;
  /** pin 时用于 UI 角标 */
  focusSource?: 'pin' | 'auto';
}

const INCOMPLETE = new Set([
  'created',
  'routed',
  'queued',
  'running',
  'waiting_approval',
  'failed',
]);

function sortByUpdatedDesc(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function buildTaskFocus(task: Task, source: 'pin' | 'auto'): DeliveryFocus {
  if (task.status === 'running') {
    return {
      kind: 'task_running',
      currentLabel: `正在执行：${task.title}`,
      completionHint: '完成条件：执行成功结束或失败后可重试/处理审批。',
      primaryCta: { label: '查看任务', href: `/tasks/${task.id}` },
      blocker: null,
      focusSource: source,
    };
  }
  if (task.status === 'waiting_approval') {
    return {
      kind: 'task_waiting_approval',
      currentLabel: `等待审批：${task.title}`,
      completionHint: '完成条件：关联审批通过后继续执行。',
      primaryCta: { label: '打开任务', href: `/tasks/${task.id}` },
      blocker: '任务处于等待审批状态，需先通过审批。',
      focusSource: source,
    };
  }
  const isFailed = task.status === 'failed';
  return {
    kind: 'task_continue',
    currentLabel: isFailed ? `需关注：${task.title}（执行失败）` : `进行中：${task.title}`,
    completionHint: isFailed
      ? '可打开任务查看错误并重试执行。'
      : '完成条件：执行完成或标记结束。',
    primaryCta: { label: '继续处理', href: `/tasks/${task.id}` },
    blocker: isFailed ? '上次执行失败，请在任务详情中查看原因。' : null,
    focusSource: source,
  };
}

/**
 * Picks a single “Delivery Lighthouse” focus for /tasks.
 * Priority: **pin** → (待审批且「简易或审批压过向导」) → **高级向导** → 其余与原先一致。
 */
export function deriveDeliveryFocus(input: {
  tasks: Task[];
  pendingApprovals: PendingApprovalLite[];
  creationMode: 'simple' | 'advanced';
  wizardContext: WizardContext | null;
  prefs: DeliveryHeroDerivationPrefs;
}): DeliveryFocus {
  const { tasks, pendingApprovals, creationMode, wizardContext, prefs } = input;
  const pending = pendingApprovals.filter((a) => a.status === 'pending');
  const sorted = sortByUpdatedDesc(tasks);

  const pinId = prefs.pinnedTaskId.trim();
  if (pinId) {
    const pinned = tasks.find((t) => t.id === pinId);
    if (pinned) {
      return buildTaskFocus(pinned, 'pin');
    }
  }

  const showApprovalFirst =
    pending.length > 0 && (creationMode === 'simple' || prefs.approvalsOverWizard);
  if (showApprovalFirst) {
    return {
      kind: 'approval_queue',
      currentLabel: '待处理：审批队列中有阻塞项',
      completionHint: '完成条件：在审批队列中批准或拒绝相关请求。',
      primaryCta: { label: '前往审批', href: '/approvals' },
      blocker: `当前有 ${pending.length} 条待处理审批，交付可能被阻塞。`,
      focusSource: 'auto',
    };
  }

  if (creationMode === 'advanced') {
    const wc = wizardContext ?? { step: 1 as const, hasDraft: false };
    const stepLabels: Record<1 | 2 | 3, { title: string; hint: string }> = {
      1: {
        title: wc.hasDraft ? '正在：需求澄清（向导第 1/4 步）' : '正在：输入需求（向导第 1/4 步）',
        hint: wc.hasDraft
          ? '完成条件：与 AI 对齐需求，直至系统允许进入「确认设计方案」。'
          : '完成条件：提交一句话描述并成功创建需求草稿。',
      },
      2: {
        title: '正在：确认设计方案（向导第 2/4 步）',
        hint: '完成条件：确认设计摘要后生成实施计划。',
      },
      3: {
        title: '正在：实施计划与建任务（向导第 3/4 步）',
        hint: '完成条件：确认计划并创建正式任务。',
      },
    };
    const { title, hint } = stepLabels[wc.step];
    return {
      kind: 'wizard',
      currentLabel: title,
      completionHint: hint,
      primaryCta: { label: '回到向导继续', hash: '#delivery-wizard' },
      blocker: null,
      focusSource: 'auto',
    };
  }

  const running = sorted.find((t) => t.status === 'running');
  if (running) {
    return buildTaskFocus(running, 'auto');
  }

  const waitAppr = sorted.find((t) => t.status === 'waiting_approval');
  if (waitAppr) {
    return buildTaskFocus(waitAppr, 'auto');
  }

  const cont = sorted.find((t) => INCOMPLETE.has(t.status) && t.status !== 'waiting_approval');
  if (cont) {
    return buildTaskFocus(cont, 'auto');
  }

  return {
    kind: 'idle',
    currentLabel: '暂无进行中的交付',
    completionHint: '可从简易任务或高级向导发起一条新的端到端交付。',
    primaryCta: { label: '发起新任务', hash: '#delivery-wizard' },
    blocker: null,
    focusSource: 'auto',
  };
}
