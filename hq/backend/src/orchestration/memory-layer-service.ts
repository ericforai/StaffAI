import { randomUUID } from 'node:crypto';
import {
  MemoryLayer,
  MemoryEntry,
  MemoryLoadPolicy,
  MemoryWritebackPolicy,
  DEFAULT_LOAD_POLICY,
  DEFAULT_WRITEBACK_POLICY,
} from '../shared/memory-layer-types';

class MemoryEntryStore {
  private entries = new Map<string, MemoryEntry>();

  async save(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry });
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getByLayer(layer: MemoryLayer): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values()).filter((e) => e.layer === layer);
  }

  async getByTask(taskId: string): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values()).filter(
      (e) => e.sourceTaskId === taskId
    );
  }

  count(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

export class MemoryLayerService {
  private entryStore: MemoryEntryStore;
  private loadPolicy: MemoryLoadPolicy;
  private writebackPolicy: MemoryWritebackPolicy;

  constructor(deps?: {
    loadPolicy?: MemoryLoadPolicy;
    writebackPolicy?: MemoryWritebackPolicy;
  }) {
    this.entryStore = new MemoryEntryStore();
    this.loadPolicy = deps?.loadPolicy ?? DEFAULT_LOAD_POLICY;
    this.writebackPolicy = deps?.writebackPolicy ?? DEFAULT_WRITEBACK_POLICY;
  }

  async loadMemory(taskId: string): Promise<{
    excerpts: string[];
    entries: MemoryEntry[];
    totalChars: number;
  }> {
    const allEntries: MemoryEntry[] = [];
    let totalChars = 0;

    for (const layer of this.loadPolicy.layers) {
      const layerEntries = await this.entryStore.getByLayer(layer);
      const limited = layerEntries.slice(0, this.loadPolicy.maxEntriesPerLayer);
      for (const entry of limited) {
        totalChars += entry.content.length;
        if (totalChars >= this.loadPolicy.maxTotalChars) break;
        allEntries.push(entry);
      }
    }

    return {
      excerpts: allEntries.map((e) => e.content),
      entries: allEntries,
      totalChars,
    };
  }

  async writeback(
    taskId: string,
    executionSummary: string,
    options?: {
      targetLayer?: MemoryLayer;
      facts?: string[];
      agentId?: string;
    }
  ): Promise<MemoryEntry[]> {
    const target = options?.targetLayer ?? this.writebackPolicy.targetLayer;
    const entries: MemoryEntry[] = [];
    const now = new Date().toISOString();

    entries.push({
      id: randomUUID(),
      layer: target,
      summary: executionSummary,
      content: executionSummary,
      category: 'execution_result',
      sourceTaskId: taskId,
      sourceAgentId: options?.agentId,
      createdAt: now,
      updatedAt: now,
    });

    if (options?.facts) {
      for (const fact of options.facts) {
        if (entries.length >= this.writebackPolicy.maxEntries) {
          break;
        }
        entries.push({
          id: randomUUID(),
          layer: target,
          summary: fact,
          content: fact,
          category: 'learned_fact',
          sourceTaskId: taskId,
          sourceAgentId: options?.agentId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const entry of entries) {
      await this.entryStore.save(entry);
    }

    return entries;
  }
}

export function createMemoryLayerService(
  loadPolicy?: Partial<MemoryLoadPolicy>,
  writebackPolicy?: Partial<MemoryWritebackPolicy>
): MemoryLayerService {
  return new MemoryLayerService({
    loadPolicy: loadPolicy as MemoryLoadPolicy,
    writebackPolicy: writebackPolicy as MemoryWritebackPolicy,
  });
}
