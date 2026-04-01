import test from 'node:test';
import assert from 'node:assert/strict';
import { InspectorService } from '../orchestration/inspector-service';
import { OKRRecord } from '../shared/intent-types';

// Mock Store
class MockStore {
  okrs: OKRRecord[] = [];
  async getOKRs() { return this.okrs; }
}

test('InspectorService should identify OKR gaps', async () => {
  const store = new MockStore();
  const inspector = new InspectorService(store as any);

  store.okrs = [
    {
      id: 'okr_1',
      objective: 'High Quality',
      keyResults: [
        { id: 'kr_1', description: 'Test Coverage', targetValue: 90, currentValueValue: 60, metricKey: 'test_coverage', unit: '%', status: 'behind' }
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  const gaps = await inspector.inspect();
  assert.strictEqual(gaps.length, 1);
  assert.strictEqual(gaps[0].metricKey, 'test_coverage');
});
