/**
 * Memory Layer Service
 *
 * Orchestrates loading and writing across the L1/L2/L3 memory hierarchy.
 * This service provides the unified interface for memory operations during
 * task execution.
 *
 * Layer Definitions:
 * - L1 (Organization): Company-wide knowledge, read-only during execution
 * - L2 (Project): Project-specific memory, read/write, includes task summaries
 * - L3 (Agent): Agent's private experience, read/write, agent-specific
 *
 * @module orchestration/memory-layer-service
 */

import path from 'node:path';
import type { ExecutionLifecycleRecord } from '../runtime/execution-service';
import type { TaskRecord } from '../shared/task-types';
import {
  retrieveMemoryContext,
  writeExecutionSummaryToMemory,
} from '../memory/memory-retriever';
import {
  createWriteBackService,
  classifyExecutionOutcome,
} from '../memory/write-back-service';
import type {
  MemoryEntry,
  MemoryLayer,
  MemoryLoadPolicy,
  MemoryLoadResult,
  MemoryWritebackPolicy,
  MemoryWritebackResult,
} from '../shared/memory-layer-types';

/**
 * Configuration for creating a MemoryLayerService
 */
export interface MemoryLayerServiceConfig {
  /** Root directory containing .ai/ folder */
  memoryRootDir: string;
  /** Default load policy (uses DEFAULT_LOAD_POLICY if not provided) */
  defaultLoadPolicy?: Partial<MemoryLoadPolicy>;
  /** Default writeback policy (uses DEFAULT_WRITEBACK_POLICY if not provided) */
  defaultWritebackPolicy?: Partial<MemoryWritebackPolicy>;
}

/**
 * Service for managing L1/L2/L3 memory layer operations
 */
export class MemoryLayerService {
  private readonly memoryRootDir: string;
  private readonly defaultLoadPolicy: MemoryLoadPolicy;
  private readonly defaultWritebackPolicy: MemoryWritebackPolicy;
  private readonly writeBackService: ReturnType<typeof createWriteBackService>;

  constructor(config: MemoryLayerServiceConfig) {
    this.memoryRootDir = config.memoryRootDir;
    this.defaultLoadPolicy = this.buildLoadPolicy(config.defaultLoadPolicy);
    this.defaultWritebackPolicy = this.buildWritebackPolicy(config.defaultWritebackPolicy);
    this.writeBackService = createWriteBackService({
      memoryRootDir: config.memoryRootDir,
      enableSuccessFailureCategorization: true,
      enableDecisionRecords: true,
      retainLegacyTaskSummaries: true,
    });
  }

  /**
   * Loads memory context from specified layers for task execution
   *
   * @param task - The task being executed
   * @param policy - Override policy for this load operation
   * @returns Combined context from all requested layers
   */
  public async loadMemory(
    task: TaskRecord,
    policy?: Partial<MemoryLoadPolicy>
  ): Promise<MemoryLoadResult> {
    const effectivePolicy: MemoryLoadPolicy = {
      ...this.defaultLoadPolicy,
      ...policy,
      layers: policy?.layers ?? this.defaultLoadPolicy.layers,
    };

    const query = effectivePolicy.query ?? `${task.title}\n${task.description}`;
    const allEntries: MemoryEntry[] = [];
    let totalContext = '';

    // Load from each requested layer
    for (const layer of effectivePolicy.layers) {
      const layerResult = this.loadFromLayer(layer, query, effectivePolicy);
      allEntries.push(...layerResult.entries);

      // Append to context if we have room
      const projectedLength = totalContext.length + layerResult.context.length + 2; // +2 for "\n\n"
      if (totalContext.length === 0 || projectedLength <= effectivePolicy.maxContextChars) {
        totalContext = totalContext ? `${totalContext}\n\n${layerResult.context}` : layerResult.context;
      }
    }

    // Sort entries by score and trim to max entries per layer
    const sortedEntries = this.sortAndTrimEntries(
      allEntries,
      effectivePolicy.maxEntriesPerLayer
    );

    // Count entries by layer
    const entriesByLayer: Partial<Record<MemoryLayer, number>> = {};
    for (const entry of sortedEntries) {
      entriesByLayer[entry.layer] = (entriesByLayer[entry.layer] ?? 0) + 1;
    }

    return {
      context: totalContext,
      entries: sortedEntries,
      metadata: {
        totalEntries: sortedEntries.length,
        entriesByLayer,
        query,
      },
    };
  }

  /**
   * Writes an execution summary to memory layers
   *
   * @param task - The task that was executed
   * @param execution - The execution record
   * @param policy - Override policy for this writeback
   * @returns Writeback result with file paths
   */
  public async writeback(
    task: TaskRecord,
    execution: ExecutionLifecycleRecord,
    policy?: Partial<MemoryWritebackPolicy>
  ): Promise<MemoryWritebackResult> {
    const effectivePolicy: MemoryWritebackPolicy = {
      ...this.defaultWritebackPolicy,
      ...policy,
    };

    // Use the enhanced write-back service for L2
    if (effectivePolicy.primaryLayer === 'L2') {
      try {
        const result = this.writeBackService.writeExecutionSummary(task, execution);
        if (result.success) {
          return {
            success: true,
            filePath: result.filePath,
            relativePath: result.relativePath,
            layer: 'L2',
          };
        }
        return {
          success: false,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Fallback to legacy writeExecutionSummaryToMemory for L1/L3
    const filePath = writeExecutionSummaryToMemory(task, execution, {
      memoryRootDir: this.memoryRootDir,
    });

    return {
      success: true,
      filePath,
      relativePath: path.relative(this.memoryRootDir, filePath),
      layer: effectivePolicy.primaryLayer,
    };
  }

  /**
   * Loads memory from a specific layer
   */
  private loadFromLayer(
    layer: MemoryLayer,
    query: string,
    policy: MemoryLoadPolicy
  ): { entries: MemoryEntry[]; context: string } {
    const result = retrieveMemoryContext(query, {
      memoryRootDir: this.memoryRootDir,
      limit: policy.maxEntriesPerLayer,
      contextMaxChars: Math.floor(policy.maxContextChars / policy.layers.length),
      excerptMaxChars: 300,
    });

    const entries: MemoryEntry[] = result.entries.map((entry) => ({
      layer,
      relativePath: entry.relativePath,
      excerpt: entry.excerpt,
      score: entry.score,
      modifiedAtMs: 0, // Not tracked in current implementation
    }));

    return {
      entries,
      context: result.context,
    };
  }

  /**
   * Sorts entries by score and trims to max entries per layer
   */
  private sortAndTrimEntries(
    entries: MemoryEntry[],
    maxPerLayer: number
  ): MemoryEntry[] {
    // Group by layer
    const byLayer = new Map<MemoryLayer, MemoryEntry[]>();
    for (const entry of entries) {
      const layer = entry.layer;
      if (!byLayer.has(layer)) {
        byLayer.set(layer, []);
      }
      byLayer.get(layer)!.push(entry);
    }

    // Sort each layer by score (descending) and take top N
    const trimmed: MemoryEntry[] = [];
    for (const [layer, layerEntries] of byLayer) {
      const sorted = layerEntries.sort((a, b) => b.score - a.score);
      trimmed.push(...sorted.slice(0, maxPerLayer));
    }

    // Return sorted by score across all layers
    return trimmed.sort((a, b) => b.score - a.score);
  }

  /**
   * Builds complete load policy with defaults
   */
  private buildLoadPolicy(partial?: Partial<MemoryLoadPolicy>): MemoryLoadPolicy {
    const base: MemoryLoadPolicy = {
      layers: ['L1', 'L2'],
      maxEntriesPerLayer: 5,
      maxContextChars: 2000,
      includeL1: true,
      includeL2: true,
      includeL3: false,
    };
    return { ...base, ...partial };
  }

  /**
   * Builds complete writeback policy with defaults
   */
  private buildWritebackPolicy(partial?: Partial<MemoryWritebackPolicy>): MemoryWritebackPolicy {
    const base: MemoryWritebackPolicy = {
      primaryLayer: 'L2',
      writeToAgentExperience: false,
      categorizeByOutcome: true,
      retainLegacyFormat: true,
    };
    return { ...base, ...partial };
  }
}

/**
 * Creates a MemoryLayerService instance
 */
export function createMemoryLayerService(
  config: MemoryLayerServiceConfig
): MemoryLayerService {
  return new MemoryLayerService(config);
}
