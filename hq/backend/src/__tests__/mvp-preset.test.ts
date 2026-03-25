import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAvailablePresets,
  getPresetByName,
  activatePreset,
  deactivatePreset,
  PresetNotFoundError,
} from '../orchestration/mvp-preset';
import type { Agent } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockAgent(id: string): Agent {
  return {
    id,
    filePath: `/agents/${id}.md`,
    department: 'engineering',
    frontmatter: { name: id, description: `Agent: ${id}` },
    content: '',
    systemPrompt: '',
  };
}

function makeMockScanner(agents: Agent[]) {
  return {
    getAllAgents: () => agents,
  };
}

function makeMockStore(initialIds: string[] = []) {
  let activeIds = [...initialIds];
  return {
    getActiveIds: () => [...activeIds],
    save: (ids: string[]) => {
      activeIds = [...ids];
    },
    _getState: () => [...activeIds],
  };
}

// ---------------------------------------------------------------------------
// getAvailablePresets
// ---------------------------------------------------------------------------

test('getAvailablePresets returns at least 3 presets', () => {
  const presets = getAvailablePresets();
  assert.ok(presets.length >= 3);
});

test('getAvailablePresets includes full-stack-dev preset with correct roles', () => {
  const presets = getAvailablePresets();
  const fsd = presets.find((p) => p.name === 'full-stack-dev');
  assert.ok(fsd, 'full-stack-dev preset should exist');
  assert.ok(fsd.roles.includes('software-architect'));
  assert.ok(fsd.roles.includes('frontend-developer'));
  assert.ok(fsd.roles.includes('code-reviewer'));
  assert.equal(fsd.defaultExecutionMode, 'serial');
});

test('getAvailablePresets includes code-review and architecture presets', () => {
  const presets = getAvailablePresets();
  const names = presets.map((p) => p.name);
  assert.ok(names.includes('code-review'));
  assert.ok(names.includes('architecture'));
});

// ---------------------------------------------------------------------------
// getPresetByName
// ---------------------------------------------------------------------------

test('getPresetByName returns preset when found', () => {
  const preset = getPresetByName('code-review');
  assert.ok(preset);
  assert.equal(preset.name, 'code-review');
  assert.ok(preset.roles.includes('code-reviewer'));
});

test('getPresetByName returns undefined for unknown preset', () => {
  const preset = getPresetByName('nonexistent');
  assert.equal(preset, undefined);
});

// ---------------------------------------------------------------------------
// activatePreset
// ---------------------------------------------------------------------------

test('activatePreset hires all preset agents into active squad', () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('frontend-developer'),
    makeMockAgent('code-reviewer'),
    makeMockAgent('technical-writer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = activatePreset('full-stack-dev', store, scanner);

  assert.equal(result.preset.name, 'full-stack-dev');
  assert.equal(result.hired.length, 5);
  assert.equal(result.alreadyActive.length, 0);
  assert.equal(result.missing.length, 0);
  assert.equal(store._getState().length, 5);
});

test('activatePreset is idempotent — already-active agents not re-hired', () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('code-reviewer'),
  ];
  const store = makeMockStore(['code-reviewer']);
  const scanner = makeMockScanner(agents);

  const result = activatePreset('code-review', store, scanner);

  assert.equal(result.hired.length, 1);
  assert.deepEqual(result.hired, ['software-architect']);
  assert.equal(result.alreadyActive.length, 1);
  assert.deepEqual(result.alreadyActive, ['code-reviewer']);
  assert.equal(store._getState().length, 2);
});

test('activatePreset reports missing agents', () => {
  const agents = [makeMockAgent('software-architect')];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = activatePreset('code-review', store, scanner);

  assert.equal(result.hired.length, 1);
  assert.equal(result.missing.length, 1);
  assert.ok(result.missing.includes('code-reviewer'));
});

test('activatePreset throws PresetNotFoundError for unknown preset', () => {
  const store = makeMockStore();
  const scanner = makeMockScanner([]);

  assert.throws(
    () => activatePreset('nonexistent', store, scanner),
    (err: Error) => err instanceof PresetNotFoundError
  );
});

test('activatePreset does not call store.save when all agents already active', () => {
  const agents = [
    makeMockAgent('code-reviewer'),
    makeMockAgent('software-architect'),
  ];
  let saveCalled = false;
  const store = {
    getActiveIds: () => ['code-reviewer', 'software-architect'],
    save: (ids: string[]) => {
      saveCalled = true;
    },
  };
  const scanner = makeMockScanner(agents);

  const result = activatePreset('code-review', store, scanner);

  assert.equal(result.hired.length, 0);
  assert.equal(result.alreadyActive.length, 2);
  assert.equal(saveCalled, false);
});

// ---------------------------------------------------------------------------
// deactivatePreset
// ---------------------------------------------------------------------------

test('deactivatePreset clears the active squad', () => {
  const store = makeMockStore(['a', 'b', 'c']);
  deactivatePreset(store);
  assert.deepEqual(store._getState(), []);
});
