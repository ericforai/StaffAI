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

/** Maps legacy/normalized keys to registry ids (e.g. architecture-analysis → architecture). */
const PRESET_KEY_ALIASES: Readonly<Record<string, string>> = {
  'architecture-analysis': 'architecture',
};

export function canonicalMvpPresetKey(name: string): string {
  return name.trim().replace(/_/g, '-');
}

function resolvePresetRegistryKey(name: string): string | undefined {
  const trimmed = name.trim();
  if (MVP_PRESETS.has(trimmed)) {
    return trimmed;
  }
  const canonical = canonicalMvpPresetKey(trimmed);
  if (MVP_PRESETS.has(canonical)) {
    return canonical;
  }
  const alias = PRESET_KEY_ALIASES[canonical] ?? PRESET_KEY_ALIASES[trimmed];
  return alias && MVP_PRESETS.has(alias) ? alias : undefined;
}

const MVP_PRESETS: ReadonlyMap<string, MvpPreset> = new Map([
  [
    'architecture',
    {
      name: 'architecture',
      description: '架构分析团队 — 架构评估与决策',
      roles: ['software-architect', 'backend-architect', 'code-reviewer'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['src/shared', 'src/orchestration'],
    },
  ],
  [
    'code-review',
    {
      name: 'code-review',
      description: '代码评审团队 — 轻量级评审',
      roles: ['code-reviewer', 'software-architect'],
      defaultExecutionMode: 'serial' as const,
      defaultContextPaths: ['src/shared'],
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
      defaultContextPaths: ['src/shared', 'src/persistence', 'src/web'],
    },
  ],
]);

function getPresetFromRegistry(name: string): MvpPreset | undefined {
  const key = resolvePresetRegistryKey(name);
  return key ? MVP_PRESETS.get(key) : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all available MVP presets.
 */
export function getAvailablePresets(): MvpPreset[] {
  return Array.from(MVP_PRESETS.values());
}

/**
 * Look up a single preset by name. Returns undefined when not found.
 */
export function getPresetByName(name: string): MvpPreset | undefined {
  return getPresetFromRegistry(name);
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
