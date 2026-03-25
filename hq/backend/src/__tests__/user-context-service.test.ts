import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getCurrentUser,
  filterAgentsByUser,
  checkAccess,
  type UserContext,
  type AccessLevel,
} from '../memory/user-context-service';

test('getCurrentUser extracts user context from environment variables', () => {
  const originalUser = process.env.USER;
  const originalHome = process.env.HOME;

  process.env.USER = 'testuser';
  process.env.HOME = '/home/testuser';

  const user = getCurrentUser();

  assert.equal(user.id, 'testuser');
  assert.equal(user.name, 'testuser');
  assert.equal(user.homeDir, '/home/testuser');
  assert.equal(user.accessLevel, 'full');

  process.env.USER = originalUser;
  process.env.HOME = originalHome;
});

test('getCurrentUser handles missing environment variables', () => {
  const originalUser = process.env.USER;
  const originalHome = process.env.HOME;

  delete process.env.USER;
  delete process.env.HOME;

  const user = getCurrentUser();

  assert.equal(user.id, 'anonymous');
  assert.equal(user.name, 'Anonymous User');
  assert.equal(user.accessLevel, 'full');
  assert.ok(user.homeDir.length > 0);

  process.env.USER = originalUser;
  process.env.HOME = originalHome;
});

test('getCurrentUser parses AGENT_ACCESS_LEVEL for access control', () => {
  const originalUser = process.env.USER;
  const originalAccess = process.env.AGENT_ACCESS_LEVEL;

  process.env.USER = 'testuser';
  process.env.AGENT_ACCESS_LEVEL = 'readonly';

  const user = getCurrentUser();

  assert.equal(user.accessLevel, 'readonly');

  process.env.USER = originalUser;
  process.env.AGENT_ACCESS_LEVEL = originalAccess;
});

test('getCurrentUser defaults to full access when invalid level provided', () => {
  const originalUser = process.env.USER;
  const originalAccess = process.env.AGENT_ACCESS_LEVEL;

  process.env.USER = 'testuser';
  process.env.AGENT_ACCESS_LEVEL = 'invalid';

  const user = getCurrentUser();

  assert.equal(user.accessLevel, 'full');

  process.env.USER = originalUser;
  process.env.AGENT_ACCESS_LEVEL = originalAccess;
});

test('filterAgentsByUser filters agents based on user access level', () => {
  const agents = [
    { id: 'public-agent', name: 'Public Agent', access: 'public' },
    { id: 'internal-agent', name: 'Internal Agent', access: 'internal' },
    { id: 'admin-agent', name: 'Admin Agent', access: 'admin' },
  ];

  const limitedUser: UserContext = {
    id: 'limited',
    name: 'Limited User',
    homeDir: '/home/limited',
    accessLevel: 'limited',
  };

  const filtered = filterAgentsByUser(agents, limitedUser);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'public-agent');
});

test('filterAgentsByUser allows full access to all agents', () => {
  const agents = [
    { id: 'public-agent', name: 'Public Agent', access: 'public' },
    { id: 'internal-agent', name: 'Internal Agent', access: 'internal' },
    { id: 'admin-agent', name: 'Admin Agent', access: 'admin' },
  ];

  const fullUser: UserContext = {
    id: 'admin',
    name: 'Admin User',
    homeDir: '/home/admin',
    accessLevel: 'full',
  };

  const filtered = filterAgentsByUser(agents, fullUser);

  assert.equal(filtered.length, 3);
});

test('filterAgentsByUser handles readonly access level', () => {
  const agents = [
    { id: 'public-agent', name: 'Public Agent', access: 'public' },
    { id: 'internal-agent', name: 'Internal Agent', access: 'internal' },
  ];

  const readonlyUser: UserContext = {
    id: 'readonly',
    name: 'Readonly User',
    homeDir: '/home/readonly',
    accessLevel: 'readonly',
  };

  const filtered = filterAgentsByUser(agents, readonlyUser);

  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((agent: any) => agent.readonly === true || agent.access === 'public'));
});

test('filterAgentsByUser handles empty agent list', () => {
  const user: UserContext = {
    id: 'test',
    name: 'Test User',
    homeDir: '/home/test',
    accessLevel: 'full',
  };

  const filtered = filterAgentsByUser([], user);

  assert.equal(filtered.length, 0);
});

test('filterAgentsByUser handles agents without access field', () => {
  const agents = [
    { id: 'agent1', name: 'Agent 1' },
    { id: 'agent2', name: 'Agent 2', access: 'internal' },
  ];

  const limitedUser: UserContext = {
    id: 'limited',
    name: 'Limited User',
    homeDir: '/home/limited',
    accessLevel: 'limited',
  };

  const filtered = filterAgentsByUser(agents, limitedUser);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'agent1');
});

test('checkAccess grants access for full access level', () => {
  const fullUser: UserContext = {
    id: 'admin',
    name: 'Admin',
    homeDir: '/home/admin',
    accessLevel: 'full',
  };

  assert.equal(checkAccess(fullUser, 'public'), true);
  assert.equal(checkAccess(fullUser, 'internal'), true);
  assert.equal(checkAccess(fullUser, 'admin'), true);
});

test('checkAccess restricts access for limited access level', () => {
  const limitedUser: UserContext = {
    id: 'limited',
    name: 'Limited',
    homeDir: '/home/limited',
    accessLevel: 'limited',
  };

  assert.equal(checkAccess(limitedUser, 'public'), true);
  assert.equal(checkAccess(limitedUser, 'internal'), false);
  assert.equal(checkAccess(limitedUser, 'admin'), false);
});

test('checkAccess restricts access for readonly access level', () => {
  const readonlyUser: UserContext = {
    id: 'readonly',
    name: 'Readonly',
    homeDir: '/home/readonly',
    accessLevel: 'readonly',
  };

  assert.equal(checkAccess(readonlyUser, 'public'), true);
  assert.equal(checkAccess(readonlyUser, 'internal'), true);
  assert.equal(checkAccess(readonlyUser, 'admin'), false);
});

test('checkAccess handles unknown resource levels', () => {
  const user: UserContext = {
    id: 'test',
    name: 'Test',
    homeDir: '/home/test',
    accessLevel: 'limited',
  };

  assert.equal(checkAccess(user, 'unknown' as AccessLevel), false);
});

test('checkAccess handles custom user permissions', () => {
  const user: UserContext = {
    id: 'custom',
    name: 'Custom',
    homeDir: '/home/custom',
    accessLevel: 'limited',
    customPermissions: ['internal-read'],
  };

  assert.equal(checkAccess(user, 'internal'), true);
  assert.equal(checkAccess(user, 'admin'), false);
});

test('getCurrentUser reads user config from .ai/user.json if exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-user-config-'));
  const aiDir = path.join(root, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  const userConfig = {
    id: 'configuser',
    name: 'Config User',
    email: 'config@example.com',
    accessLevel: 'readonly',
  };

  fs.writeFileSync(
    path.join(aiDir, 'user.json'),
    JSON.stringify(userConfig),
    'utf8'
  );

  const originalHome = process.env.HOME;
  process.env.HOME = root;

  const user = getCurrentUser();

  assert.equal(user.id, 'configuser');
  assert.equal(user.name, 'Config User');
  assert.equal(user.accessLevel, 'readonly');

  process.env.HOME = originalHome;
  fs.rmSync(root, { recursive: true, force: true });
});

test('getCurrentUser falls back to environment when user.json is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-no-config-'));
  const aiDir = path.join(root, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  const originalHome = process.env.HOME;
  const originalUser = process.env.USER;

  process.env.HOME = root;
  process.env.USER = 'envuser';

  const user = getCurrentUser();

  assert.equal(user.id, 'envuser');
  assert.equal(user.name, 'envuser');

  process.env.HOME = originalHome;
  process.env.USER = originalUser;
  fs.rmSync(root, { recursive: true, force: true });
});

test('getCurrentUser handles malformed user.json gracefully', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-malformed-'));
  const aiDir = path.join(root, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  fs.writeFileSync(
    path.join(aiDir, 'user.json'),
    '{ invalid json }',
    'utf8'
  );

  const originalHome = process.env.HOME;
  const originalUser = process.env.USER;

  process.env.HOME = root;
  process.env.USER = 'fallback';

  const user = getCurrentUser();

  assert.equal(user.id, 'fallback');

  process.env.HOME = originalHome;
  process.env.USER = originalUser;
  fs.rmSync(root, { recursive: true, force: true });
});

test('filterAgentsByUser respects user.customPermissions whitelist', () => {
  const agents = [
    { id: 'agent1', name: 'Agent 1', access: 'public' },
    { id: 'agent2', name: 'Agent 2', access: 'internal' },
    { id: 'agent3', name: 'Agent 3', access: 'admin' },
  ];

  const user: UserContext = {
    id: 'custom',
    name: 'Custom User',
    homeDir: '/home/custom',
    accessLevel: 'limited',
    customPermissions: ['agent2'],
  };

  const filtered = filterAgentsByUser(agents, user);

  assert.equal(filtered.length, 2);
  assert.ok(filtered.some((a: any) => a.id === 'agent1'));
  assert.ok(filtered.some((a: any) => a.id === 'agent2'));
  assert.ok(!filtered.some((a: any) => a.id === 'agent3'));
});

test('filterAgentsByUser handles agents with metadata-based access', () => {
  const agents = [
    {
      id: 'agent1',
      name: 'Agent 1',
      access: 'internal',
      metadata: { requiredPermission: 'team-lead' },
    },
    {
      id: 'agent2',
      name: 'Agent 2',
      access: 'internal',
      metadata: { requiredPermission: 'developer' },
    },
  ];

  const user: UserContext = {
    id: 'dev',
    name: 'Developer',
    homeDir: '/home/dev',
    accessLevel: 'limited',
    customPermissions: ['developer'],
  };

  const filtered = filterAgentsByUser(agents, user);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'agent2');
});

test('checkAccess validates resource-based access control', () => {
  const user: UserContext = {
    id: 'test',
    name: 'Test',
    homeDir: '/home/test',
    accessLevel: 'limited',
  };

  assert.equal(checkAccess(user, 'public', 'read'), true);
  assert.equal(checkAccess(user, 'public', 'write'), false);
  assert.equal(checkAccess(user, 'internal', 'read'), false);
  assert.equal(checkAccess(user, 'internal', 'write'), false);
});

test('checkAccess supports operation-level access for readonly users', () => {
  const user: UserContext = {
    id: 'readonly',
    name: 'Readonly',
    homeDir: '/home/readonly',
    accessLevel: 'readonly',
  };

  assert.equal(checkAccess(user, 'internal', 'read'), true);
  assert.equal(checkAccess(user, 'internal', 'write'), false);
  assert.equal(checkAccess(user, 'admin', 'read'), false);
});
