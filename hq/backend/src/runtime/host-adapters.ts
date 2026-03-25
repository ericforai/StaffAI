import { promises as fs } from 'node:fs';
import path from 'node:path';

export type HostCapabilityLevel = 'full' | 'partial' | 'advisory';
export type HostId = 'claude' | 'codex' | 'gemini' | 'cursor';
export type ExecutorName = 'claude' | 'codex' | 'openai';

export interface HostManifest {
  project: {
    name: string;
    stateDir: string;
    webUrl: string;
    apiUrl: string;
    mcpEntry: string;
  };
  hosts: HostAdapter[];
}

export interface HostAdapter {
  id: HostId;
  label: string;
  configFile: string;
  instructionTitle: string;
  snippetTarget: string;
  capabilityLevel: HostCapabilityLevel;
  supportedExecutors: ExecutorName[];
  supportsSampling: boolean;
  supportsInjection: boolean;
  supportsRuntimeExecution: boolean;
  injection: {
    targetFile: string;
    strategy: 'append' | 'replace' | 'manual';
    priority: 'primary' | 'secondary';
  };
  degradation: {
    mode: 'native' | 'partial' | 'advisory';
    manualFallback: string;
  };
}

const defaultManifestPath = path.resolve(__dirname, '../../../config/host-manifest.json');

export async function loadHostManifest(manifestPath: string = defaultManifestPath): Promise<HostManifest> {
  const raw = await fs.readFile(manifestPath, 'utf-8');
  return JSON.parse(raw) as HostManifest;
}

export async function listHostAdapters(manifestPath?: string): Promise<HostAdapter[]> {
  const manifest = await loadHostManifest(manifestPath);
  return manifest.hosts;
}

export async function getHostAdapter(hostId: HostId, manifestPath?: string): Promise<HostAdapter | undefined> {
  const adapters = await listHostAdapters(manifestPath);
  return adapters.find((adapter) => adapter.id === hostId);
}

export function renderHostInjectionSnippet(host: HostAdapter): string {
  return [
    `## ${host.instructionTitle}`,
    '',
    'Use The Agency HQ as the primary multi-agent command deck for expert discovery, runtime recommendations, and execution routing.',
    '',
    `- Host: ${host.label}`,
    `- Primary target: ${host.injection.targetFile}`,
    `- Injection strategy: ${host.injection.strategy}`,
    `- Capability level: ${host.capabilityLevel}`,
    `- Supported executors: ${host.supportedExecutors.join(', ') || 'manual only'}`,
    '',
    'Runtime fallback:',
    `- ${host.degradation.manualFallback}`,
    '',
    'If native execution is unavailable, fallback to the Web UI or manual injection instead of inventing a parallel workflow.',
  ].join('\n');
}
