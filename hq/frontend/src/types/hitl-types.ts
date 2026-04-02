/**
 * HITL (Human-in-the-Loop) Types
 * Aligns with backend PendingHumanInput in src/shared/hitl-types.ts
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

export interface RespondToAssignmentInput {
  answer: string;
  answeredBy?: string;
}
