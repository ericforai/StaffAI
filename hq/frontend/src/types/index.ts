export * from './domain';
export * from './api';

/**
 * Backward compatibility aliases
 * These map old 'Summary' names used throughout the app to the new DDD names.
 */
import { 
  Task, 
  Approval, 
  TaskExecution, 
  WorkflowPlan, 
  TaskAssignment, 
  ToolCall 
} from './domain';

export type TaskSummary = Task;
export type ApprovalSummary = Approval;
export type ExecutionSummary = TaskExecution;
export type WorkflowPlanSummary = WorkflowPlan;
export type TaskAssignmentSummary = TaskAssignment;
export type ToolCallSummary = ToolCall;
