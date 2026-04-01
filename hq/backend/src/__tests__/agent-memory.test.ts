import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentMemory, ExperienceEntry, BehavioralHeuristic } from '../shared/intent-types';

test('AgentMemory domain models should be correctly defined', () => {
  const memory: AgentMemory = {
    agentId: 'software-architect',
    experienceLog: [
      {
        id: 'exp_1',
        taskId: 'task_1',
        title: 'Project Setup',
        insight: 'Use Postgres instead of MongoDB for ACID compliance.',
        timestamp: new Date().toISOString(),
      }
    ],
    behavioralHeuristics: [
      {
        id: 'heur_1',
        pattern: 'Missing null check',
        correction: 'Always use optional chaining or explicit null checks.',
        sourceTaskId: 'task_2',
        timestamp: new Date().toISOString(),
      }
    ],
    organizationalAwareness: {
      teamEvaluations: {
        'frontend-developer': 'Style attributes sometimes need manual review.'
      }
    },
    updatedAt: new Date().toISOString(),
  };

  assert.strictEqual(memory.agentId, 'software-architect');
  assert.strictEqual(memory.experienceLog.length, 1);
  assert.strictEqual(memory.behavioralHeuristics[0].pattern, 'Missing null check');
});
