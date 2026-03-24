import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHostPolicyConfig, getHostPolicy, validateHostPolicyConfig } from '../host-policy';

test('loadHostPolicyConfig loads runtime host policy definitions', async () => {
  const config = await loadHostPolicyConfig();
  assert.equal(config.version, '1.0.0');
  assert.equal(config.hosts.length >= 3, true);
});

test('getHostPolicy returns codex policy with enforced mode', async () => {
  const policy = await getHostPolicy('codex');
  assert.ok(policy);
  assert.equal(policy?.policyMode, 'enforced');
  assert.equal(policy?.toolRouting.preferredTools.includes('expert_discussion'), true);
});

test('validateHostPolicyConfig passes for known hosts', async () => {
  const validation = await validateHostPolicyConfig(['claude', 'codex', 'gemini']);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});
