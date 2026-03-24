import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { TaskExecutionMode, TaskRecord } from '../shared/task-types';
import { createApprovalRecord, evaluateApprovalRequirement } from '../governance/approval-service';
import { recommendTaskRoute } from './task-routing';

export interface TaskDraftInput {
  title: string;
  description: string;
  executionMode?: string;
}

export function validateTaskDraft(input: TaskDraftInput) {
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title || !description) {
    return {
      valid: false as const,
      error: 'title and description are required',
    };
  }

  return {
    valid: true as const,
    error: undefined,
  };
}

export async function createTaskDraft(
  input: TaskDraftInput,
  store: Pick<Store, 'saveTask' | 'saveApproval'>
): Promise<TaskRecord> {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const description = input.description.trim();
  const routeDecision = recommendTaskRoute({ title, description });
  const approvalDecision = evaluateApprovalRequirement({ title, description });
  const requestedExecutionMode: TaskExecutionMode =
    input.executionMode === 'advanced_discussion' ? 'advanced_discussion' : routeDecision.executionMode;

  const task: TaskRecord = {
    id: randomUUID(),
    title,
    description,
    status: approvalDecision.approvalRequired ? 'waiting_approval' : 'created',
    executionMode: requestedExecutionMode,
    approvalRequired: approvalDecision.approvalRequired,
    riskLevel: approvalDecision.riskLevel,
    recommendedAgentRole: routeDecision.recommendedAgentRole,
    routingStatus: routeDecision.routingStatus,
    createdAt: now,
    updatedAt: now,
  };

  await store.saveTask(task);
  if (approvalDecision.approvalRequired) {
    await createApprovalRecord(task.id, store);
  }
  return task;
}
