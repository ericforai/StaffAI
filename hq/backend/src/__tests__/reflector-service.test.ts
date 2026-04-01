import test from 'node:test';
import assert from 'node:assert/strict';
import { ReflectorService } from '../orchestration/reflector-service';
import { TaskRecord, ExecutionRecord } from '../shared/task-types';
import { AgentMemory } from '../shared/intent-types';

// Mock Store
class MockStore {
  memories = new Map<string, AgentMemory>();
  async getAgentMemoryByAgentId(id: string) { return this.memories.get(id) || null; }
  async saveAgentMemory(m: AgentMemory) { this.memories.set(m.agentId, m); }
}

test('ReflectorService should generate memory from task completion', async () => {
  const store = new MockStore();
  const reflector = new ReflectorService(store as any);

  const task: TaskRecord = {
    id: 'task_1',
    title: 'Update UI',
    description: 'Change button color to blue',
    recommendedAgentRole: 'frontend-developer',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;

  const execution: ExecutionRecord = {
    id: 'exec_1',
    taskId: 'task_1',
    status: 'completed',
    outputSummary: 'Updated button color to blue as requested.',
  } as any;

  await reflector.reflect(task, execution);

  const memory = await store.getAgentMemoryByAgentId('frontend-developer');
  assert.ok(memory);
  assert.strictEqual(memory?.agentId, 'frontend-developer');
});

test('ReflectorService should use extractInsights dependency if provided', async () => {
  const store = new MockStore();
  const reflector = new ReflectorService(store as any, {
    extractInsights: async () => ({
      experience: { insight: 'Advanced insight' },
      heuristics: [{ pattern: 'P1', correction: 'C1' }]
    })
  });

  const task: TaskRecord = {
    id: 'task_2',
    title: 'Update Logic',
    recommendedAgentRole: 'backend-architect',
    status: 'completed',
  } as any;

  const execution: ExecutionRecord = {
    id: 'exec_2',
    taskId: 'task_2',
    status: 'completed',
  } as any;

  await reflector.reflect(task, execution);

  const memory = await store.getAgentMemoryByAgentId('backend-architect');
  assert.strictEqual(memory?.experienceLog[0].insight, 'Advanced insight');
  assert.strictEqual(memory?.behavioralHeuristics[0].pattern, 'P1');
});
