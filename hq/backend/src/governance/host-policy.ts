import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { HostId } from '../runtime/host-adapters';

export type WorkflowStage = 'brainstorm' | 'review' | 'debug' | 'ship' | 'consult';
export type PolicyMode = 'enforced' | 'advisory';

export interface HostPolicy {
  hostId: HostId;
  policyMode: PolicyMode;
  instructionPriority: Array<'runtime-snippet' | 'project-doc' | 'user-directive'>;
  toolRouting: {
    preferredTools: string[];
    blockedTools: string[];
    fallbackTools: string[];
  };
  stageRecommendations: Record<WorkflowStage, string[]>;
}

export interface HostPolicyConfig {
  version: string;
  hosts: HostPolicy[];
}

export interface HostPolicyValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const defaultPolicyPath = path.resolve(__dirname, '../../../config/host-policy.json');
const REQUIRED_STAGES: WorkflowStage[] = ['brainstorm', 'review', 'debug', 'ship', 'consult'];

export async function loadHostPolicyConfig(configPath: string = defaultPolicyPath): Promise<HostPolicyConfig> {
  const raw = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(raw) as HostPolicyConfig;
}

export async function getHostPolicy(
  hostId: HostId,
  configPath?: string
): Promise<HostPolicy | undefined> {
  const config = await loadHostPolicyConfig(configPath);
  return config.hosts.find((host) => host.hostId === hostId);
}

export async function validateHostPolicyConfig(
  knownHostIds: string[],
  configPath?: string
): Promise<HostPolicyValidation> {
  const config = await loadHostPolicyConfig(configPath);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.version) {
    errors.push('host-policy version is required');
  }

  const seen = new Set<string>();
  for (const host of config.hosts) {
    validateSingleHostPolicy(host, knownHostIds, seen, errors, warnings);
  }

  for (const hostId of knownHostIds) {
    if (!seen.has(hostId)) {
      warnings.push(`host policy missing explicit entry for host: ${hostId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateSingleHostPolicy(
  host: HostPolicy,
  knownHostIds: string[],
  seen: Set<string>,
  errors: string[],
  warnings: string[]
): void {
  if (seen.has(host.hostId)) {
    errors.push(`duplicate host policy: ${host.hostId}`);
    return;
  }
  seen.add(host.hostId);

  if (!knownHostIds.includes(host.hostId)) {
    errors.push(`host policy references unknown host: ${host.hostId}`);
  }

  if (!Array.isArray(host.instructionPriority) || host.instructionPriority.length === 0) {
    errors.push(`host policy ${host.hostId} must define instructionPriority`);
  }

  validateToolRouting(host, errors, warnings);

  for (const stage of REQUIRED_STAGES) {
    if (!Array.isArray(host.stageRecommendations?.[stage])) {
      errors.push(`host policy ${host.hostId} missing stageRecommendations.${stage}`);
    }
  }
}

function validateToolRouting(host: HostPolicy, errors: string[], warnings: string[]): void {
  if (!host.toolRouting) {
    errors.push(`host policy ${host.hostId} must define toolRouting`);
    return;
  }

  if (!Array.isArray(host.toolRouting.preferredTools) || host.toolRouting.preferredTools.length === 0) {
    warnings.push(`host policy ${host.hostId} has no preferredTools`);
  }

  if (!Array.isArray(host.toolRouting.fallbackTools) || host.toolRouting.fallbackTools.length === 0) {
    warnings.push(`host policy ${host.hostId} has no fallbackTools`);
  }
}
