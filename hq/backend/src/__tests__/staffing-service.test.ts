import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import { createStaffingService } from '../orchestration/staffing-service';

function makeAgent(id: string, name: string): Agent {
  return {
    id,
    filePath: `/tmp/${id}.md`,
    department: 'engineering',
    frontmatter: {
      name,
      description: `${name} description`,
    },
    content: '',
    systemPrompt: '',
  };
}

test('staffing service hires missing experts and keeps already-active experts separate', () => {
  let saved: string[] = [];
  const service = createStaffingService({
    getAgent: (id: string) =>
      id === 'architect' ? makeAgent('architect', 'Architect') : id === 'writer' ? makeAgent('writer', 'Writer') : undefined,
    getActiveIds: () => ['writer'],
    saveActiveIds: (ids: string[]) => {
      saved = ids;
    },
  });

  const result = service.hireExperts(['architect', 'writer', 'missing']);
  assert.equal(result.hired.length, 1);
  assert.equal(result.hired[0]?.id, 'architect');
  assert.equal(result.alreadyActive.length, 1);
  assert.equal(result.alreadyActive[0]?.id, 'writer');
  assert.deepEqual(result.missing, ['missing']);
  assert.deepEqual(saved.sort(), ['architect', 'writer']);
});
