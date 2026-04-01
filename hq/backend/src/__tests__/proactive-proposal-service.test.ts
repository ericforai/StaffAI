import test from 'node:test';
import assert from 'node:assert/strict';
import { ProactiveProposalService } from '../orchestration/proactive-proposal-service';
import { OKRGap } from '../orchestration/inspector-service';

// Mock Store
class MockStore {
  drafts: any[] = [];
  async saveRequirementDraft(d: any) { this.drafts.push(d); }
}

test('ProactiveProposalService should generate intent and emit SSE event', async () => {
  const store = new MockStore();
  const events: any[] = [];
  const publish = (ev: any) => { events.push(ev); };
  
  const service = new ProactiveProposalService(store as any, publish);

  const gap: OKRGap = {
    id: 'kr_1',
    description: 'Test Coverage',
    targetValue: 90,
    currentValueValue: 60,
    metricKey: 'test_coverage',
    unit: '%',
    status: 'behind',
    okrId: 'okr_1',
    objective: 'High Quality'
  };

  const draft = await service.propose(gap, 'qa-engineer');
  assert.ok(draft);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'PROACTIVE_PROPOSAL');
  assert.strictEqual(events[0].intentId, draft.id);
});
