import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetService } from '../governance/budget-service';
import type { BudgetConfig } from '../shared/budget-types';

test('checkBudget returns withinBudget=true when no limits configured', async () => {
  const service = new BudgetService();
  const status = await service.checkBudget('task-1');

  assert.equal(status.withinBudget, true);
  assert.equal(status.usage.tokensUsed, 0);
  assert.equal(status.usage.estimatedCostUsd, 0);
  assert.equal(status.reason, undefined);
});

test('checkBudget returns withinBudget=false when tokens exceeded', async () => {
  const service = new BudgetService();
  const config: BudgetConfig = { maxTokens: 100 };

  // Record usage that exceeds the limit
  await service.recordUsage('task-1', 150, 0.01);

  const status = await service.checkBudget('task-1', config);

  assert.equal(status.withinBudget, false);
  assert.equal(status.reason, 'tokens_exceeded');
  assert.equal(status.usage.tokensUsed, 150);
});

test('checkBudget returns withinBudget=false when cost exceeded', async () => {
  const service = new BudgetService();
  const config: BudgetConfig = { maxCostUsd: 0.05 };

  // Record usage that exceeds the cost limit
  await service.recordUsage('task-1', 100, 0.10);

  const status = await service.checkBudget('task-1', config);

  assert.equal(status.withinBudget, false);
  assert.equal(status.reason, 'cost_exceeded');
  assert.equal(status.usage.estimatedCostUsd, 0.10);
});

test('checkBudget emits warning event at threshold', async () => {
  const warnings: Array<{ taskId: string; currentPct: number }> = [];
  const service = new BudgetService({
    onBudgetWarning: async (event) => {
      warnings.push({ taskId: event.taskId, currentPct: event.currentPct });
    },
  });
  const config: BudgetConfig = { maxCostUsd: 1.0, warningThresholdPct: 0.8 };

  // Record usage at 85% of limit (crosses 80% threshold)
  await service.recordUsage('task-1', 100, 0.85);

  const status = await service.checkBudget('task-1', config);

  assert.equal(status.withinBudget, true);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].taskId, 'task-1');
  assert.ok(warnings[0].currentPct >= 0.8);
});

test('checkBudget emits warning only once', async () => {
  const warnings: unknown[] = [];
  const service = new BudgetService({
    onBudgetWarning: async () => {
      warnings.push('warned');
    },
  });
  const config: BudgetConfig = { maxCostUsd: 1.0, warningThresholdPct: 0.8 };

  await service.recordUsage('task-1', 100, 0.85);
  await service.checkBudget('task-1', config);
  // Second check should NOT emit another warning
  await service.checkBudget('task-1', config);

  assert.equal(warnings.length, 1);
});

test('recordUsage accumulates tokens and cost correctly', async () => {
  const service = new BudgetService();

  await service.recordUsage('task-1', 100, 0.05);
  await service.recordUsage('task-1', 200, 0.10);

  const usage = service.getUsage('task-1');
  assert.ok(usage);
  assert.equal(usage.tokensUsed, 300);
  assert.ok(Math.abs(usage.estimatedCostUsd - 0.15) < 0.001, `Expected ~0.15, got ${usage.estimatedCostUsd}`);
});

test('recordUsage creates new entry for unknown task', async () => {
  const service = new BudgetService();

  // getUsage returns undefined before recording
  assert.equal(service.getUsage('task-new'), undefined);

  await service.recordUsage('task-new', 50, 0.02);

  const usage = service.getUsage('task-new');
  assert.ok(usage);
  assert.equal(usage.taskId, 'task-new');
  assert.equal(usage.tokensUsed, 50);
  assert.equal(usage.estimatedCostUsd, 0.02);
  assert.equal(usage.warningEmitted, false);
});

test('getUsage returns undefined for unknown task', () => {
  const service = new BudgetService();
  assert.equal(service.getUsage('nonexistent'), undefined);
});

test('clearUsage removes task tracking', async () => {
  const service = new BudgetService();

  await service.recordUsage('task-1', 100, 0.05);
  assert.ok(service.getUsage('task-1'));

  service.clearUsage('task-1');
  assert.equal(service.getUsage('task-1'), undefined);
});

test('getAllUsage returns copy of internal map', async () => {
  const service = new BudgetService();

  await service.recordUsage('task-1', 100, 0.05);
  await service.recordUsage('task-2', 200, 0.10);

  const allUsage = service.getAllUsage();

  assert.equal(allUsage.size, 2);
  assert.ok(allUsage.has('task-1'));
  assert.ok(allUsage.has('task-2'));

  // Verify it is a copy: clearing the returned map does not affect the service
  allUsage.delete('task-1');
  assert.ok(service.getUsage('task-1'));
});

test('checkBudget returns withinBudget=true when tokens are below limit', async () => {
  const service = new BudgetService();
  const config: BudgetConfig = { maxTokens: 1000 };

  await service.recordUsage('task-1', 500, 0.01);

  const status = await service.checkBudget('task-1', config);

  assert.equal(status.withinBudget, true);
  assert.equal(status.reason, undefined);
});

test('checkBudget returns withinBudget=true when cost is below limit', async () => {
  const service = new BudgetService();
  const config: BudgetConfig = { maxCostUsd: 1.0 };

  await service.recordUsage('task-1', 100, 0.50);

  const status = await service.checkBudget('task-1', config);

  assert.equal(status.withinBudget, true);
});

test('constructor stores options without error', () => {
  const service = new BudgetService({
    onBudgetWarning: async () => {},
  });
  assert.ok(service);
});

test('checkBudget with maxTokens=0 does not enforce token limit', async () => {
  const service = new BudgetService();
  const config: BudgetConfig = { maxTokens: 0 };

  await service.recordUsage('task-1', 99999, 0.01);

  const status = await service.checkBudget('task-1', config);
  assert.equal(status.withinBudget, true);
});

test('checkBudget with maxCostUsd=0 does not enforce cost limit', async () => {
  const service = new BudgetService();
  const config: BudgetConfig = { maxCostUsd: 0 };

  await service.recordUsage('task-1', 100, 999.0);

  const status = await service.checkBudget('task-1', config);
  assert.equal(status.withinBudget, true);
});
