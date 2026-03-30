import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createChain,
  advanceChain,
  getChain,
  isChainComplete,
  deleteChain,
  getAllChains,
} from '../governance/approval-chain-service';
import { createInMemoryApprovalChainRepository } from '../persistence/file-repositories';

test('createChain creates correct chain for LOW risk (standard - single step)', async () => {
  const repository = createInMemoryApprovalChainRepository();
  const chain = await createChain(repository, 'task-low', 'LOW');

  assert.equal(chain.taskId, 'task-low');
  assert.equal(chain.steps.length, 1);
  assert.equal(chain.steps[0].role, 'team_lead');
  assert.equal(chain.steps[0].status, 'pending');
  assert.equal(chain.currentStep, 0);
  assert.equal(chain.status, 'in_progress');
});

test('createChain creates correct chain for HIGH risk (strict - three steps)', async () => {
  const repository = createInMemoryApprovalChainRepository();
  const chain = await createChain(repository, 'task-high', 'HIGH');

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

test('createChain creates correct chain for MEDIUM risk (elevated - two steps)', async () => {
  const repository = createInMemoryApprovalChainRepository();
  const chain = await createChain(repository, 'task-med', 'MEDIUM');

  assert.equal(chain.steps.length, 2);
  assert.equal(chain.steps[0].role, 'team_lead');
  assert.equal(chain.steps[1].role, 'manager');
  assert.equal(chain.steps[0].autoApproveIfLowRisk, true);
  assert.equal(chain.steps[1].autoApproveIfLowRisk, false);
});

test('advanceChain approves first step', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-adv', 'LOW');

  const updated = await advanceChain(repository, 'task-adv', 'team_lead', 'approve', 'Looks good');

  assert.equal(updated.steps[0].status, 'approved');
  assert.equal(updated.steps[0].approver, 'team_lead');
  assert.equal(updated.steps[0].comment, 'Looks good');
  assert.ok(updated.steps[0].resolvedAt);
});

test('advanceChain rejects entire chain', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-rej', 'LOW');

  const updated = await advanceChain(repository, 'task-rej', 'team_lead', 'reject', 'Not ready');

  assert.equal(updated.steps[0].status, 'rejected');
  assert.equal(updated.status, 'rejected');
});

test('advanceChain completes chain when last step approved', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-complete', 'HIGH');

  // Approve step 1 (team_lead)
  const step1 = await advanceChain(repository, 'task-complete', 'team_lead', 'approve');
  assert.equal(step1.status, 'in_progress');
  assert.equal(step1.currentStep, 1);

  // Approve step 2 (manager)
  const step2 = await advanceChain(repository, 'task-complete', 'manager', 'approve');
  assert.equal(step2.status, 'in_progress');
  assert.equal(step2.currentStep, 2);

  // Approve step 3 (compliance) - final
  const step3 = await advanceChain(repository, 'task-complete', 'compliance', 'approve');
  assert.equal(step3.status, 'completed');
  assert.equal(step3.steps[2].status, 'approved');
});

test('advanceChain throws on role mismatch', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-mismatch', 'LOW');

  await assert.rejects(
    async () => await advanceChain(repository, 'task-mismatch', 'manager', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Role mismatch/);
      return true;
    },
  );
});

test('advanceChain throws on non-existent chain', async () => {
  const repository = createInMemoryApprovalChainRepository();

  await assert.rejects(
    async () => await advanceChain(repository, 'nonexistent', 'team_lead', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /not found/);
      return true;
    },
  );
});

test('advanceChain throws on already completed chain', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-done', 'LOW');
  await advanceChain(repository, 'task-done', 'team_lead', 'approve');

  await assert.rejects(
    async () => await advanceChain(repository, 'task-done', 'team_lead', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Cannot advance chain/);
      return true;
    },
  );
});

test('advanceChain throws on already rejected chain', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-rejected', 'LOW');
  await advanceChain(repository, 'task-rejected', 'team_lead', 'reject');

  await assert.rejects(
    async () => await advanceChain(repository, 'task-rejected', 'team_lead', 'approve'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Cannot advance chain/);
      return true;
    },
  );
});

test('getChain returns null for unknown task', async () => {
  const repository = createInMemoryApprovalChainRepository();
  assert.equal(await getChain(repository, 'unknown-task'), null);
});

test('getChain returns stored chain', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-get', 'LOW');
  const chain = await getChain(repository, 'task-get');

  assert.ok(chain);
  assert.equal(chain.taskId, 'task-get');
});

test('isChainComplete returns true only for completed chains', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-chk', 'LOW');

  // Not complete initially
  assert.equal(await isChainComplete(repository, 'task-chk'), false);

  // Approve to complete
  await advanceChain(repository, 'task-chk', 'team_lead', 'approve');
  assert.equal(await isChainComplete(repository, 'task-chk'), true);
});

test('isChainComplete returns false for rejected chains', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-chk-rej', 'LOW');
  await advanceChain(repository, 'task-chk-rej', 'team_lead', 'reject');

  assert.equal(await isChainComplete(repository, 'task-chk-rej'), false);
});

test('isChainComplete returns false for unknown task', async () => {
  const repository = createInMemoryApprovalChainRepository();
  assert.equal(await isChainComplete(repository, 'nonexistent'), false);
});

test('deleteChain removes chain', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-del', 'LOW');

  const deleted = await deleteChain(repository, 'task-del');
  assert.equal(deleted, true);
  assert.equal(await getChain(repository, 'task-del'), null);
});

test('deleteChain returns false for non-existent chain', async () => {
  const repository = createInMemoryApprovalChainRepository();
  assert.equal(await deleteChain(repository, 'nonexistent'), false);
});

test('getAllChains returns all chains', async () => {
  const repository = createInMemoryApprovalChainRepository();
  await createChain(repository, 'task-a', 'LOW');
  await createChain(repository, 'task-b', 'HIGH');

  assert.equal((await getAllChains(repository)).length, 2);
});

test('createChain does not mutate DEFAULT_CHAINS templates', async () => {
  const repository = createInMemoryApprovalChainRepository();
  const chain1 = await createChain(repository, 'task-immutable-1', 'HIGH');
  // Modify returned step
  chain1.steps[0].status = 'approved';

  // Create another chain of the same type
  const chain2 = await createChain(repository, 'task-immutable-2', 'HIGH');
  assert.equal(chain2.steps[0].status, 'pending');
});
