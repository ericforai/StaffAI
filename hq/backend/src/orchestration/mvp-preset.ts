/**
 * MVP Preset Registry
 *
 * Curated role sets for common scenarios.
 * Each preset defines a team composition that can be activated
 * in one shot, hiring all required agents into the active squad.
 */

import type { Store } from '../store';
import type { Scanner } from '../scanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MvpPreset {
  /** Unique preset key */
  name: string;
  /** Human-readable label */
  description: string;
  /** Agent role slugs to activate */
  roles: string[];
  /** Default execution mode when using this preset */
  defaultExecutionMode: 'single' | 'serial' | 'parallel';
  /** Default context paths to include in task context */
  defaultContextPaths: string[];
}

export interface PresetActivationResult {
  preset: MvpPreset;
  hired: string[];
  alreadyActive: string[];
  missing: string[];
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

const MVP_PRESETS: ReadonlyMap<string, MvpPreset> = new Map([
  [
    'architecture_analysis',
    {
      name: 'architecture_analysis',
      description: '架构分析 — 专注于系统架构评估与演进',
      roles: ['software-architect', 'backend-architect', 'code-reviewer'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['docs/architecture', 'docs/system-design'],
    },
  ],
  [
    'backend_design',
    {
      name: 'backend_design',
      description: '后端设计 — 专注于服务端接口与数据模型设计',
      roles: ['backend-architect', 'software-architect', 'code-reviewer'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['docs/backend', 'hq/backend/src'],
    },
  ],
  [
    'code_review',
    {
      name: 'code_review',
      description: '代码评审 — 专注于代码质量与工程实践',
      roles: ['code-reviewer', 'software-architect'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['docs/guidelines', '.github/pull_request_template.md'],
    },
  ],
  [
    'documentation',
    {
      name: 'documentation',
      description: '文档撰写 — 专注于技术文档与用户指南',
      roles: ['technical-writer', 'software-architect'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['docs/user-guides', 'README.md'],
    },
  ],
  [
    'workflow_dispatch',
    {
      name: 'workflow_dispatch',
      description: '工作流编排 — 专注于自动化脚本与流水线设计',
      roles: ['devops-engineer', 'software-architect', 'backend-architect'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['.github/workflows', 'scripts'],
    },
  ],
  [
    'full-stack-dev',
    {
      name: 'full-stack-dev',
      description: '全栈开发团队 — 适用于典型开发任务',
      roles: [
        'software-architect',
        'backend-architect',
        'frontend-developer',
        'code-reviewer',
        'technical-writer',
      ],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['context/project.md', 'context/architecture.md'],
    },
  ],
]);

const MVP_PRESET_ALIASES: ReadonlyMap<string, string> = new Map([
  // Historical / human-friendly aliases used by tests and UI copy
  ['architecture', 'architecture_analysis'],
  ['code-review', 'code_review'],
  ['backend-design', 'backend_design'],
]);

function resolvePresetKey(name: string): string {
  const trimmed = name.trim();
  const aliased = MVP_PRESET_ALIASES.get(trimmed);
  if (aliased) return aliased;
  // Accept both code_review and code-review styles.
  const normalized = trimmed.replace(/-/g, '_');
  return MVP_PRESETS.has(normalized) ? normalized : trimmed;
}

function getPresetFromRegistry(name: string): MvpPreset | undefined {
  return MVP_PRESETS.get(resolvePresetKey(name));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all available MVP presets.
 */
export function getAvailablePresets(): MvpPreset[] {
  const base = Array.from(MVP_PRESETS.values());
  const aliases: MvpPreset[] = [];
  for (const [alias, key] of MVP_PRESET_ALIASES.entries()) {
    const preset = MVP_PRESETS.get(key);
    if (!preset) continue;
    aliases.push({ ...preset, name: alias });
  }
  return [...base, ...aliases];
}

/**
 * Look up a single preset by name. Returns undefined when not found.
 */
export function getPresetByName(name: string): MvpPreset | undefined {
  const trimmed = name.trim();
  const canonical = getPresetFromRegistry(trimmed);
  if (!canonical) {
    return undefined;
  }

  // Preserve the caller's alias when it maps to a canonical preset.
  const resolvedKey = resolvePresetKey(trimmed);
  if (trimmed !== resolvedKey && (MVP_PRESET_ALIASES.has(trimmed) || trimmed.includes('-'))) {
    return { ...canonical, name: trimmed };
  }

  return canonical;
}

/**
 * Activate a preset by hiring every role in its definition.
 *
 * - Resolves each role slug against the scanner's agent registry.
 * - Already-active agents are left untouched (idempotent).
 * - Unresolvable roles are reported in `missing`.
 */
export function activatePreset(
  presetName: string,
  store: Pick<Store, 'getActiveIds' | 'save'>,
  scanner: Pick<Scanner, 'getAllAgents'>,
): PresetActivationResult {
  const preset = getPresetFromRegistry(presetName);
  if (!preset) {
    throw new PresetNotFoundError(presetName);
  }

  const allAgents = scanner.getAllAgents();
  const activeIds = new Set(store.getActiveIds());
  const nextActiveIds = new Set(activeIds);

  const hired: string[] = [];
  const alreadyActive: string[] = [];
  const missing: string[] = [];

  for (const role of preset.roles) {
    // Match by id (slug) — the scanner stores agents keyed by slugified name
    const agent = allAgents.find((a) => a.id === role || a.id.includes(role));
    if (!agent) {
      missing.push(role);
      continue;
    }

    if (activeIds.has(agent.id)) {
      alreadyActive.push(agent.id);
    } else {
      nextActiveIds.add(agent.id);
      hired.push(agent.id);
    }
  }

  if (hired.length > 0) {
    store.save(Array.from(nextActiveIds));
  }

  return { preset, hired, alreadyActive, missing };
}

/**
 * Deactivate all agents — clears the active squad.
 */
export function deactivatePreset(
  store: Pick<Store, 'save'>,
): void {
  store.save([]);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PresetNotFoundError extends Error {
  constructor(name: string) {
    super(`MVP preset not found: ${name}`);
    this.name = 'PresetNotFoundError';
  }
}
