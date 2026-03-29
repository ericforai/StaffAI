export const DUAL_CORE_PROTOCOL_VERSION = '1.0.0' as const;

export const STREAMING_EVENT_TYPES = [
  'execution_started',
  'execution_progress',
  'execution_completed',
  'execution_failed',
  'checkpoint_saved',
  'tool_call_started',
  'tool_call_completed',
  'human_input_requested',
] as const;

export type StreamingEventType = (typeof STREAMING_EVENT_TYPES)[number];

export interface StreamingEvent {
  type: StreamingEventType;
  protocolVersion: typeof DUAL_CORE_PROTOCOL_VERSION;
  taskId: string;
  executionId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface StateUpdatePayload {
  taskId: string;
  status: string;
  progress?: number;
  outputSnapshot?: Record<string, unknown>;
  checkpointRef?: string;
  threadId?: string;
  updatedAt: string;
}

export const CONTROL_ACTION_TYPES = [
  'pause',
  'resume',
  'cancel',
  'ask_human',
] as const;

export type ControlActionType = (typeof CONTROL_ACTION_TYPES)[number];

export interface ControlAction {
  type: ControlActionType;
  protocolVersion: typeof DUAL_CORE_PROTOCOL_VERSION;
  taskId: string;
  executionId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface PausePayload {
  reason?: string;
  requestedBy: string;
}

export interface ResumePayload {
  humanFeedback?: HumanFeedbackPayload;
  requestedBy: string;
}

export interface CancelPayload {
  reason?: string;
  requestedBy: string;
}

export interface AskHumanPayload {
  question: string;
  context?: string;
  responseType?: 'text' | 'approval' | 'choice';
  choices?: string[];
}

export interface HumanFeedbackPayload {
  feedbackText: string;
  feedbackType: 'text' | 'approval' | 'choice';
  attachments?: string[];
  responder: string;
  respondedAt: string;
}

export const DUAL_CORE_ERROR_CODES = [
  'RUNTIME_UNAVAILABLE',
  'INVALID_CHECKPOINT',
  'APPROVAL_REQUIRED',
  'HUMAN_INPUT_REQUIRED',
  'EXECUTION_TIMEOUT',
  'EXECUTION_FAILED',
  'PROTOCOL_VERSION_MISMATCH',
  'INVALID_ENVELOPE',
] as const;

export type DualCoreErrorCode = (typeof DUAL_CORE_ERROR_CODES)[number];

export interface DualCoreError {
  code: DualCoreErrorCode;
  message: string;
  taskId?: string;
  executionId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
  retriable: boolean;
}

export function createStreamingEvent(
  type: StreamingEventType,
  taskId: string,
  data: Record<string, unknown>,
  executionId?: string
): StreamingEvent {
  return {
    type,
    protocolVersion: DUAL_CORE_PROTOCOL_VERSION,
    taskId,
    executionId,
    timestamp: new Date().toISOString(),
    data,
  };
}

export function createControlAction(
  type: ControlActionType,
  taskId: string,
  payload: Record<string, unknown>,
  executionId?: string
): ControlAction {
  return {
    type,
    protocolVersion: DUAL_CORE_PROTOCOL_VERSION,
    taskId,
    executionId,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function createDualCoreError(
  code: DualCoreErrorCode,
  message: string,
  options: { taskId?: string; executionId?: string; retriable?: boolean; details?: Record<string, unknown> } = {}
): DualCoreError {
  return {
    code,
    message,
    taskId: options.taskId,
    executionId: options.executionId,
    timestamp: new Date().toISOString(),
    details: options.details,
    retriable: options.retriable ?? false,
  };
}
