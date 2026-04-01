import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { TaskRecord, ExecutionRecord } from '../shared/task-types';
import type { AgentMemory, ExperienceEntry, BehavioralHeuristic } from '../shared/intent-types';

export interface ReflectorDependencies {
  // Placeholder for future LLM adapter
  extractInsights?: (task: TaskRecord, execution: ExecutionRecord) => Promise<{
    experience?: Partial<ExperienceEntry>;
    heuristics?: Partial<BehavioralHeuristic>[];
  }>;
}

export class ReflectorService {
  constructor(
    private readonly store: Store,
    private readonly deps: ReflectorDependencies = {}
  ) {}

  public async reflect(task: TaskRecord, execution: ExecutionRecord): Promise<void> {
    const agentId = task.recommendedAgentRole;
    if (!agentId) return;

    let memory = await this.store.getAgentMemoryByAgentId(agentId);
    if (!memory) {
      memory = {
        agentId,
        experienceLog: [],
        behavioralHeuristics: [],
        organizationalAwareness: { teamEvaluations: {} },
        updatedAt: new Date().toISOString(),
      };
    }

    if (this.deps.extractInsights) {
      const insights = await this.deps.extractInsights(task, execution);
      if (insights.experience) {
        memory.experienceLog.push({
          id: randomUUID(),
          taskId: task.id,
          title: task.title,
          insight: insights.experience.insight || execution.outputSummary || 'Task completed.',
          timestamp: new Date().toISOString(),
          ...insights.experience,
        });
      }
      if (insights.heuristics) {
        for (const h of insights.heuristics) {
          memory.behavioralHeuristics.push({
            id: randomUUID(),
            pattern: h.pattern || 'Unknown',
            correction: h.correction || 'None',
            sourceTaskId: task.id,
            timestamp: new Date().toISOString(),
            ...h,
          });
        }
      }
    } else {
      // Default basic experience entry
      const entry: ExperienceEntry = {
        id: randomUUID(),
        taskId: task.id,
        title: task.title,
        insight: execution.outputSummary || 'Task completed successfully.',
        timestamp: new Date().toISOString(),
      };
      memory.experienceLog.push(entry);
    }

    memory.updatedAt = new Date().toISOString();

    await this.store.saveAgentMemory(memory);
  }
}
