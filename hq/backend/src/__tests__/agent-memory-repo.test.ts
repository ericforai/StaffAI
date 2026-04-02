import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFileAgentMemoryRepository } from '../persistence/file-repositories';
import { AgentMemory } from '../shared/intent-types';

const TEST_STORAGE_PATH = path.join(__dirname, '../../test-agent-memory.json');

test('FileAgentMemoryRepository should save and load memory', async () => {
  if (fs.existsSync(TEST_STORAGE_PATH)) fs.unlinkSync(TEST_STORAGE_PATH);

  const repo = createFileAgentMemoryRepository(TEST_STORAGE_PATH);
  const memory: AgentMemory = {
    agentId: 'test-agent',
    experienceLog: [],
    behavioralHeuristics: [],
    organizationalAwareness: { teamEvaluations: {} },
    updatedAt: new Date().toISOString(),
  };

  await repo.saveAgentMemory(memory);
  const loaded = await repo.getAgentMemoryByAgentId('test-agent');

  assert.ok(loaded);
  assert.strictEqual(loaded?.agentId, 'test-agent');

  if (fs.existsSync(TEST_STORAGE_PATH)) fs.unlinkSync(TEST_STORAGE_PATH);
});
