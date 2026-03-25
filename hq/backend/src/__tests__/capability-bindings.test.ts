import test from 'node:test';
import assert from 'node:assert/strict';
import { Scanner } from '../scanner';
import {
  loadCapabilityBindingsConfig,
  resolveCapabilityBindings,
  validateCapabilityBindingsConfig,
} from '../governance/capability-bindings';

test('loadCapabilityBindingsConfig reads binding definitions', async () => {
  const config = await loadCapabilityBindingsConfig();
  assert.equal(config.version, '1.0.0');
  assert.equal(config.bindings.length >= 2, true);
});

test('resolveCapabilityBindings maps bindings to concrete agent ids', async () => {
  const scanner = new Scanner();
  await scanner.scan();
  const config = await loadCapabilityBindingsConfig();
  const resolved = resolveCapabilityBindings(config.bindings, scanner);

  assert.equal(Array.isArray(resolved), true);
  assert.equal(
    resolved.some((binding) => Array.isArray(binding.matchedAgentIds)),
    true
  );
});

test('validateCapabilityBindingsConfig validates hosts and runtime selectors', async () => {
  const scanner = new Scanner();
  await scanner.scan();
  const validation = await validateCapabilityBindingsConfig(scanner, ['claude', 'codex', 'gemini']);

  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});
