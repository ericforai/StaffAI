export const SUSPEND_REASONS = [
  'missing_information',
  'approval_required',
  'draft_review_required',
] as const;

export type SuspendReason = (typeof SUSPEND_REASONS)[number];

export interface SuspendPayload {
  reason: SuspendReason;
  message: string;
  suspendedBy: string;
  suspendedAt: string;
  context?: Record<string, unknown>;
}

export const FEEDBACK_TYPES = ['text', 'approval', 'choice'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export interface HumanFeedbackPayload {
  feedbackText: string;
  feedbackType: FeedbackType;
  attachments?: string[];
  responder: string;
  respondedAt: string;
}

export interface ResumePayload {
  feedback: HumanFeedbackPayload;
  resumedBy: string;
}

/**
 * Stores pending human input needed for an assignment to continue.
 * The runtime detects {{HITL_NEED_INPUT}} marker → stores here → assignment pauses.
 */
export interface PendingHumanInput {
  id: string;
  assignmentId: string;
  taskId: string;
  /** The questions or context the agent needs human input for */
  questions: string;
  /** Full output snapshot that triggered the need for input */
  outputSnapshot?: Record<string, unknown>;
  status: 'pending' | 'answered' | 'cancelled';
  createdAt: string;
  answeredAt?: string;
  answer?: string;
  answeredBy?: string;
}
