import { Task, Approval, TaskExecution, WorkflowPlan, TaskAssignment } from './domain';

/**
 * StaffAI API Contracts
 * These types define the shape of request/response payloads and messaging.
 */

export interface TaskDetailPayload {
  task: Task;
  approvals: Approval[];
  executions: TaskExecution[];
  workflowPlan?: WorkflowPlan | null;
  assignments?: TaskAssignment[];
}

export interface SquadState {
  activeAgentIds: string[];
}

export interface TaskEvent {
  type: 'TASK_EVENT';
  taskEventType: string;
  message: string;
  taskId?: string;
  approvalId?: string;
  executionId?: string;
  timestamp: string;
  payload?: any;
}

/**
 * WebSocket Message Interface
 */
export interface WsMessage {
  type: string;
  [key: string]: any;
}
