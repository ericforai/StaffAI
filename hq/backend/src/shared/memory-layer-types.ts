export const MEMORY_LAYERS = ['L1', 'L2', 'L3'] as const;
export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export interface MemoryLayerDefinition {
  layer: MemoryLayer;
  name: string;
  directory: string;
  ownership: 'task' | 'project' | 'organization';
  persistence: 'ephemeral' | 'persistent' | 'permanent';
  readPolicy: 'task_only' | 'project_scoped' | 'global';
  writePolicy: 'executor_only' | 'project_member' | 'admin';
  description: string;
}

export const MEMORY_LAYER_DEFINITIONS: Record<MemoryLayer, MemoryLayerDefinition> = {
  L1: {
    layer: 'L1',
    name: 'Session/Task Context',
    directory: '.ai/memory/L1-session',
    ownership: 'task',
    persistence: 'ephemeral',
    readPolicy: 'task_only',
    writePolicy: 'executor_only',
    description: 'Short-lived context for a single task execution. Includes loaded memory excerpts, task-specific facts, and intermediate results.',
  },
  L2: {
    layer: 'L2',
    name: 'Project/Workspace Knowledge',
    directory: '.ai/memory/L2-project',
    ownership: 'project',
    persistence: 'persistent',
    readPolicy: 'project_scoped',
    writePolicy: 'project_member',
    description: 'Project-scoped knowledge accumulated across tasks. Includes project conventions, architecture decisions, and commonly-used patterns.',
  },
  L3: {
    layer: 'L3',
    name: 'Organization/Agent Knowledge',
    directory: '.ai/memory/L3-organization',
    ownership: 'organization',
    persistence: 'permanent',
    readPolicy: 'global',
    writePolicy: 'admin',
    description: 'Organization-wide knowledge shared across all projects and agents. Includes company policies, domain expertise, and best practices.',
  },
};

export interface MemoryEntry {
  id: string;
  layer: MemoryLayer;
  summary: string;
  content: string;
  category: string;
  sourceTaskId?: string;
  sourceAgentId?: string;
  createdAt: string;
  updatedAt: string;
  relevanceScore?: number;
}

export interface MemoryLoadPolicy {
  layers: MemoryLayer[];
  maxEntriesPerLayer: number;
  maxTotalChars: number;
  withScoring: boolean;
}

export interface MemoryWritebackPolicy {
  targetLayer: MemoryLayer;
  writeSummary: boolean;
  writeFacts: boolean;
  maxEntries: number;
}

export const DEFAULT_LOAD_POLICY: MemoryLoadPolicy = {
  layers: ['L1', 'L2'],
  maxEntriesPerLayer: 5,
  maxTotalChars: 2000,
  withScoring: true,
};

export const DEFAULT_WRITEBACK_POLICY: MemoryWritebackPolicy = {
  targetLayer: 'L2',
  writeSummary: true,
  writeFacts: true,
  maxEntries: 3,
};
