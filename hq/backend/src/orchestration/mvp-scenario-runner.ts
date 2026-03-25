/**
 * MVP Scenario Runner
 *
 * End-to-end orchestrator for the MVP acceptance flow:
 *   input task → activate preset → auto-select roles → create task
 *   → build workflow plan → audit event → trackable result
 */

import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { Scanner } from '../scanner';
import type { AgentProfile } from '../types';
import type {
  TaskRecord,
  WorkflowPlan,
  TaskAssignment,
  TaskExecutionMode,
} from '../shared/task-types';
import {
  activatePreset,
  getPresetByName,
  getAvailablePresets,
  type MvpPreset,
  PresetNotFoundError,
} from './mvp-preset';
import { createTask } from './task-orchestrator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MvpScenarioInput {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Explicit preset name. When omitted the runner auto-selects. */
  presetName?: string;
  /** Override execution mode (defaults to preset's default) */
  executionMode?: TaskExecutionMode;
  /** Who requested the scenario */
  requestedBy?: string;
}

export interface MvpScenarioResult {
  /** Created task record */
  task: TaskRecord;
  /** Generated workflow plan */
  workflowPlan: WorkflowPlan;
  /** Generated assignments */
  assignments: TaskAssignment[];
  /** Which preset was activated */
  presetUsed: MvpPreset;
  /** Audit trail ID for tracking */
  auditTrailId: string;
}

// ---------------------------------------------------------------------------
// Auto-select heuristic
// ---------------------------------------------------------------------------

const KEYWORD_PRESET_MAP: Array<{ keywords: string[]; presetName: string }> = [
  { keywords: ['review', 'code review', '代码评审', '审查'], presetName: 'code-review' },
  { keywords: ['architecture', '架构', 'design', '设计'], presetName: 'architecture' },
];

function autoSelectPreset(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();

  for (const entry of KEYWORD_PRESET_MAP) {
    for (const keyword of entry.keywords) {
      if (combined.includes(keyword)) {
        return entry.presetName;
      }
    }
  }

  // Default to full-stack-dev
  return 'full-stack-dev';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runMvpScenario(
  input: MvpScenarioInput,
  store: Store,
  scanner: Scanner,
): Promise<MvpScenarioResult> {
  // 1. Resolve preset
  const presetName = input.presetName || autoSelectPreset(input.title, input.description);
  const preset = getPresetByName(presetName);
  if (!preset) {
    throw new PresetNotFoundError(presetName);
  }

  // 2. Activate preset (idempotent hire) — use canonical registry key
  activatePreset(preset.name, store, scanner);

  // 3. Build agent profiles from scanner for routing
  const allAgents = scanner.getAllAgents();
  const profiles: AgentProfile[] = allAgents
    .filter((a) => a.profile)
    .map((a) => a.profile!);

  // 4. Create task with routing + plan
  const executionMode = input.executionMode || preset.defaultExecutionMode;
  const requestedBy = input.requestedBy || 'mvp-scenario';

  const result = await createTask(
    {
      title: input.title,
      description: input.description,
      executionMode,
      requestedBy,
    },
    store,
    { getAgentProfiles: () => profiles },
  );

  // 5. Log audit event for scenario
  const auditTrailId = randomUUID();
  await store.logAudit({
    entityType: 'task',
    entityId: result.task.id,
    action: 'scenario_started',
    actor: requestedBy,
    newState: {
      presetName,
      executionMode,
      workflowPlanId: result.workflowPlan.id,
      auditTrailId,
    },
  });

  return {
    task: result.task,
    workflowPlan: result.workflowPlan,
    assignments: result.assignments,
    presetUsed: preset,
    auditTrailId,
  };
}
