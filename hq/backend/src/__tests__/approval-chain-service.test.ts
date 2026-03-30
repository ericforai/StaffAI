import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createChain,
  advanceChain,
  getChain,
  isChainComplete,
  deleteChain,
  clearAllChains,
  getAllChains,
} from '../governance/approval-chain-service';

test('createChain creates correct chain for LOW risk (standard - single step)', () => {
  clearAllChains();
  const chain = createChain('task-low', 'LOW');

  assert.equal(chain.taskId, 'task-low');
  assert.equal(chain.steps.length, 1);
  assert.equal(chain.steps[0].role, 'team_lead');
  assert.equal(chain.steps[0].status, 'pending');
  assert.equal(chain.currentStep, 0);
  assert.equal(chain.status, 'in_progress');
});

test('createChain creates correct chain for HIGH risk (strict - three steps)', () => {
  clearAllChains();
  const chain = createChain('task-high', 'HIGH');

  assert.equal(chain.taskId, 'task-high');
  assert.equal(chain.steps.length, 3);
  assert.equal(chain.steps[0].role, 'team_lead');
  assert.equal(chain.steps[1].role, 'manager');
  assert.equal(chain.steps[2].role, 'compliance');
  assert.equal(chain.currentStep, 0);
  assert.equal(chain.status, 'in_progress');

  // All strict steps should have autoApproveIfLowRisk=false
  for (const step of chain.steps) {
    assert.equal(step.autoApproveIfLowRisk, false);
  }
});

test('createChain creates correct chain for MEDIUM risk (elevated - two steps)', () => {
  clearAllChains();
  const chain = createChain('task-med', 'MEDIUM');

  assert.equal(chain.steps.length, 2);
  assert.equal(chain.steps[0].role, 'team_lead');
  assert.equal(chain.steps[1].role, 'manager');
  assert.equal(chain.steps[0].autoApproveIfLowRisk, true);
  assert.equal(chain.steps[1].autoApproveIfLowRisk, false);
});

test('advanceChain approves first step', () => {
  clearAllChains();
  createChain('task-adv', 'LOW');

  const updated = advanceChain('task-adv', 'team_lead', 'approve', 'Looks good');

  assert.equal(updated.steps[0].status, 'approved');
  assert.equal(updated.steps[0].approver, 'team_lead');
  assert.equal(updated.steps[0].comment, 'Looks good');
  assert.ok(updated.steps[0].resolvedAt);
});

test('advanceChain rejects entire chain', () => {
  clearAllChains();
  createChain('task-rej', 'LOW');

  const updated = advanceChain('task-rej', 'team_lead', 'reject', 'Not ready');

  assert.equal(updated.steps[0].status, 'rejected');
  assert.equal(updated.status, 'rejected');
});

test('advanceChain completes chain when last step approved', () => {
  clearAllChains();
  createChain('task-complete', 'HIGH');

  // Approve step 1 (team_lead)
  const step1 = advanceChain('task-complete', 'team_lead', 'approve');
  assert.equal(step1.status, 'in_progress');
  assert.equal(step1.currentStep, 1);

  // Approve step 2 (manager)
  const step2 = advanceChain('task-complete', 'manager', 'approve');
  assert.equal(step2.status, 'in_progress');
  assert.equal(step2.currentStep, 2);

  // Approve step 3 (compliance) - final
  const step3 = advanceChain('task-complete', 'compliance', 'approve');
  assert.equal(step3.status, 'completed');
  assert.equal(step3.steps[2].status, 'approved');
});

test('advanceChain throws on role mismatch', () => {
  clearAllChains();
  createChain('task-mismatch', 'LOW');

  assert.throws(
    () => advanceChain('task-mismatch', 'manager', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Role mismatch/);
      return true;
    },
  );
});

test('advanceChain throws on non-existent chain', () => {
  clearAllChains();

  assert.throws(
    () => advanceChain('nonexistent', 'team_lead', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /not found/);
      return true;
    },
  );
});

test('advanceChain throws on already completed chain', () => {
  clearAllChains();
  createChain('task-done', 'LOW');
  advanceChain('task-done', 'team_lead', 'approve');

  assert.throws(
    () => advanceChain('task-done', 'team_lead', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Cannot advance chain/);
      return true;
    },
  );
});

test('advanceChain throws on already rejected chain', () => {
  clearAllChains();
  createChain('task-rejected', 'LOW');
  advanceChain('task-rejected', 'team_lead', 'reject');

  assert.throws(
    () => advanceChain('task-rejected', 'team_lead', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Cannot advance chain/);
      return true;
    },
  );
});

test('getChain returns undefined for unknown task', () => {
  clearAllChains();
  assert.equal(getChain('unknown-task'), undefined);
});

test('getChain returns stored chain', () => {
  clearAllChains();
  createChain('task-get', 'LOW');
  const chain = getChain('task-get');

  assert.ok(chain);
  assert.equal(chain.taskId, 'task-get');
});

test('isChainComplete returns true only for completed chains', () => {
  clearAllChains();
  createChain('task-chk', 'LOW');

  // Not complete initially
  assert.equal(isChainComplete('task-chk'), false);

  // Approve to complete
  advanceChain('task-chk', 'team_lead', 'approve');
  assert.equal(isChainComplete('task-chk'), true);
});

test('isChainComplete returns false for rejected chains', () => {
  clearAllChains();
  createChain('task-chk-rej', 'LOW');
  advanceChain('task-chk-rej', 'team_lead', 'reject');

  assert.equal(isChainComplete('task-chk-rej'), false);
});

test('isChainComplete returns false for unknown task', () => {
  clearAllChains();
  assert.equal(isChainComplete('nonexistent'), false);
});

test('deleteChain removes chain', () => {
  clearAllChains();
  createChain('task-del', 'LOW');

  const deleted = deleteChain('task-del');
  assert.equal(deleted, true);
  assert.equal(getChain('task-del'), undefined);
});

test('deleteChain returns false for non-existent chain', () => {
  clearAllChains();
  assert.equal(deleteChain('nonexistent'), false);
});

test('clearAllChains resets all chains', () => {
  clearAllChains();
  createChain('task-a', 'LOW');
  createChain('task-b', 'HIGH');

  assert.equal(getAllChains().length, 2);

  clearAllChains();

  assert.equal(getAllChains().length, 0);
  assert.equal(getChain('task-a'), undefined);
  assert.equal(getChain('task-b'), undefined);
});

test('createChain does not mutate DEFAULT_CHAINS templates', () => {
  clearAllChains();
  const chain1 = createChain('task-immutable-1', 'HIGH');
  // Modify returned step
  chain1.steps[0].status = 'approved';

  // Create another chain of the same type
  const chain2 = createChain('task-immutable-2', 'HIGH');
  assert.equal(chain2.steps[0].status, 'pending');
});
