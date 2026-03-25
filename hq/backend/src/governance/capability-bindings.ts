import { promises as fs } from 'fs';
import path from 'path';
import type { Scanner } from '../scanner';
import type { HostId, ExecutorName } from '../runtime/host-adapters';

export interface CapabilityBindingMatch {
  agentIds?: string[];
  departments?: string[];
  idPatterns?: string[];
}

export interface CapabilityBindingRuntime {
  requiredCapabilities: string[];
  preferredExecutors: ExecutorName[];
  fallbackMode: 'web_ui' | 'serial' | 'consult_only';
  recommendedHosts: HostId[];
}

export interface CapabilityBinding {
  id: string;
  label: string;
  description: string;
  match: CapabilityBindingMatch;
  runtime: CapabilityBindingRuntime;
}

export interface CapabilityBindingsConfig {
  version: string;
  bindings: CapabilityBinding[];
}

export interface ResolvedCapabilityBinding extends CapabilityBinding {
  matchedAgentIds: string[];
}

export interface CapabilityBindingsValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const defaultBindingsPath = path.resolve(__dirname, '../../../config/capability-bindings.json');

export async function loadCapabilityBindingsConfig(
  configPath: string = defaultBindingsPath
): Promise<CapabilityBindingsConfig> {
  const raw = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(raw) as CapabilityBindingsConfig;
}

function matchAgentIdByPatterns(agentId: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return true;
  }

  const lowered = agentId.toLowerCase();
  return patterns.some((pattern) => lowered.includes(pattern.toLowerCase()));
}

export function resolveCapabilityBindings(
  bindings: CapabilityBinding[],
  scanner: Scanner
): ResolvedCapabilityBinding[] {
  const agents = scanner.getAllAgents();

  return bindings.map((binding) => {
    const matchedAgentIds = agents
      .filter((agent) => {
        const match = binding.match;
        const idAllowed =
          !match.agentIds || match.agentIds.length === 0 || match.agentIds.includes(agent.id);
        const deptAllowed =
          !match.departments ||
          match.departments.length === 0 ||
          match.departments.includes(agent.department);
        const patternAllowed = matchAgentIdByPatterns(agent.id, match.idPatterns);
        return idAllowed && deptAllowed && patternAllowed;
      })
      .map((agent) => agent.id);

    return {
      ...binding,
      matchedAgentIds,
    };
  });
}

export async function validateCapabilityBindingsConfig(
  scanner: Scanner,
  knownHostIds: string[],
  configPath?: string
): Promise<CapabilityBindingsValidation> {
  const config = await loadCapabilityBindingsConfig(configPath);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.version) {
    errors.push('capability-bindings version is required');
  }

  const seen = new Set<string>();
  const resolved = resolveCapabilityBindings(config.bindings, scanner);

  for (const binding of resolved) {
    if (seen.has(binding.id)) {
      errors.push(`duplicate capability binding id: ${binding.id}`);
      continue;
    }
    seen.add(binding.id);

    if (!binding.label || !binding.description) {
      errors.push(`capability binding ${binding.id} must define label and description`);
    }

    if (!Array.isArray(binding.runtime.requiredCapabilities) || binding.runtime.requiredCapabilities.length === 0) {
      errors.push(`capability binding ${binding.id} must define runtime.requiredCapabilities`);
    }

    if (!Array.isArray(binding.runtime.preferredExecutors) || binding.runtime.preferredExecutors.length === 0) {
      errors.push(`capability binding ${binding.id} must define runtime.preferredExecutors`);
    }

    if (!Array.isArray(binding.runtime.recommendedHosts) || binding.runtime.recommendedHosts.length === 0) {
      errors.push(`capability binding ${binding.id} must define runtime.recommendedHosts`);
    } else {
      for (const hostId of binding.runtime.recommendedHosts) {
        if (!knownHostIds.includes(hostId)) {
          errors.push(`capability binding ${binding.id} references unknown host: ${hostId}`);
        }
      }
    }

    if (binding.matchedAgentIds.length === 0) {
      warnings.push(`capability binding ${binding.id} currently matches 0 agents`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
