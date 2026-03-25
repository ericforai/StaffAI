/**
 * Identity Module Tests
 * Tests for user context, repository, and permission checker
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUserRepository, createPermissionChecker, createUserContextService } from '../identity';
import type { UserConfig } from '../identity/user-types';
import type { Agent } from '../types';
import type { Template } from '../identity/permission-checker';

// Test utilities
function createTestAgent(id: string, department: string, name: string): Agent {
  return {
    id,
    filePath: `/test/${id}.md`,
    department,
    frontmatter: {
      name,
      description: `Test agent for ${name}`,
    },
    content: 'Test content',
    systemPrompt: 'Test system prompt',
    profile: {
      id,
      name,
      department,
      role: 'tester',
      responsibilities: ['testing'],
      tools: [],
      allowedTaskTypes: ['general'],
      riskScope: 'low',
      executionPreferences: {
        preferredMode: 'single',
        preferredExecutor: 'claude',
        supportsParallelWork: false,
        discussionCapable: false,
      },
      outputContract: {
        primaryFormat: 'markdown',
        sections: [],
      },
    },
  };
}

function createTestTemplate(id: string, department?: string, owner?: string): Template {
  return {
    id,
    name: `Template ${id}`,
    department,
    owner,
  };
}

test('UserRepository returns default user when file does not exist', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-test-'));
  const usersFile = path.join(tempDir, 'users.json');

  try {
    const repo = createUserRepository(usersFile);
    const user = repo.getUser('any-user');

    assert.notEqual(user, null);
    assert.equal(user?.id, 'user-default');
    assert.equal(user?.name, 'Default User');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('UserRepository loads users from file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-test-'));
  const usersFile = path.join(tempDir, 'users.json');

  try {
    const testPolicy = {
      version: '1.0',
      defaultPolicy: 'allowAll' as const,
      users: [
        {
          id: 'test-user',
          name: 'Test User',
          department: 'engineering',
          clearanceLevel: 'senior' as const,
          allowedAgentIds: ['frontend-developer'],
          allowedAgentDepartments: [],
          allowedAgentTags: [],
          deniedAgentIds: [],
          templateAccess: 'all' as const,
          memoryAccess: {
            canReadProject: true,
            canReadDecisions: true,
            allowedDomains: [],
          },
          enabled: true,
        },
      ],
    };

    fs.writeFileSync(usersFile, JSON.stringify(testPolicy));
    const repo = createUserRepository(usersFile);
    const user = repo.getUser('test-user');

    assert.notEqual(user, null);
    assert.equal(user?.id, 'test-user');
    assert.equal(user?.name, 'Test User');
    assert.equal(user?.clearanceLevel, 'senior');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('UserRepository only returns enabled users', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-test-'));
  const usersFile = path.join(tempDir, 'users.json');

  try {
    const testPolicy = {
      version: '1.0',
      defaultPolicy: 'denyAll' as const, // Use denyAll so disabled users get null
      users: [
        {
          id: 'active-user',
          name: 'Active User',
          department: 'engineering',
          clearanceLevel: 'basic' as const,
          allowedAgentIds: [],
          allowedAgentDepartments: [],
          allowedAgentTags: [],
          deniedAgentIds: [],
          templateAccess: 'all' as const,
          memoryAccess: {
            canReadProject: true,
            canReadDecisions: true,
            allowedDomains: [],
          },
          enabled: true,
        },
        {
          id: 'disabled-user',
          name: 'Disabled User',
          department: 'engineering',
          clearanceLevel: 'basic' as const,
          allowedAgentIds: [],
          allowedAgentDepartments: [],
          allowedAgentTags: [],
          deniedAgentIds: [],
          templateAccess: 'all' as const,
          memoryAccess: {
            canReadProject: true,
            canReadDecisions: true,
            allowedDomains: [],
          },
          enabled: false,
        },
      ],
    };

    fs.writeFileSync(usersFile, JSON.stringify(testPolicy));
    const repo = createUserRepository(usersFile);

    assert.equal(repo.isEnabled('active-user'), true);
    assert.equal(repo.isEnabled('disabled-user'), false);
    // With denyAll policy, disabled user returns null
    assert.equal(repo.getUser('disabled-user'), null);
    // Active user still works
    assert.notEqual(repo.getUser('active-user'), null);
    assert.equal(repo.getUser('active-user')?.id, 'active-user');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('UserRepository does not start file watchers under node test', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-test-'));
  const usersFile = path.join(tempDir, 'users.json');
  const originalWatchFile = fs.watchFile;
  let watchCalls = 0;

  fs.watchFile = ((...args: Parameters<typeof fs.watchFile>) => {
    watchCalls += 1;
    return originalWatchFile(...args);
  }) as typeof fs.watchFile;

  try {
    const repo = createUserRepository(usersFile);
    repo.dispose();
    assert.equal(watchCalls, 0);
  } finally {
    fs.watchFile = originalWatchFile;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('PermissionChecker allows all agents when no restrictions', () => {
  const checker = createPermissionChecker();
  const user: UserConfig = {
    id: 'test-user',
    name: 'Test User',
    department: 'engineering',
    clearanceLevel: 'basic',
    allowedAgentIds: [],
    allowedAgentDepartments: [],
    allowedAgentTags: [],
    deniedAgentIds: [],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };

  const agents = [
    createTestAgent('frontend-dev', 'engineering', 'Frontend Developer'),
    createTestAgent('backend-dev', 'engineering', 'Backend Developer'),
    createTestAgent('designer', 'design', 'Designer'),
  ];

  const filtered = checker.filterAgents(user, agents);
  assert.equal(filtered.length, 3);
});

test('PermissionChecker filters by allowedAgentIds', () => {
  const checker = createPermissionChecker();
  const user: UserConfig = {
    id: 'test-user',
    name: 'Test User',
    department: 'engineering',
    clearanceLevel: 'basic',
    allowedAgentIds: ['frontend-dev'],
    allowedAgentDepartments: [],
    allowedAgentTags: [],
    deniedAgentIds: [],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };

  const agents = [
    createTestAgent('frontend-dev', 'engineering', 'Frontend Developer'),
    createTestAgent('backend-dev', 'engineering', 'Backend Developer'),
  ];

  const filtered = checker.filterAgents(user, agents);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'frontend-dev');
});

test('PermissionChecker filters by allowedAgentDepartments', () => {
  const checker = createPermissionChecker();
  const user: UserConfig = {
    id: 'test-user',
    name: 'Test User',
    department: 'engineering',
    clearanceLevel: 'basic',
    allowedAgentIds: [],
    allowedAgentDepartments: ['engineering'],
    allowedAgentTags: [],
    deniedAgentIds: [],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };

  const agents = [
    createTestAgent('frontend-dev', 'engineering', 'Frontend Developer'),
    createTestAgent('backend-dev', 'engineering', 'Backend Developer'),
    createTestAgent('designer', 'design', 'Designer'),
  ];

  const filtered = checker.filterAgents(user, agents);
  assert.equal(filtered.length, 2);
  assert.equal(filtered.every((a) => a.department === 'engineering'), true);
});

test('PermissionChecker denies agents in deniedAgentIds', () => {
  const checker = createPermissionChecker();
  const user: UserConfig = {
    id: 'test-user',
    name: 'Test User',
    department: 'engineering',
    clearanceLevel: 'basic',
    allowedAgentIds: [],
    allowedAgentDepartments: [],
    allowedAgentTags: [],
    deniedAgentIds: ['frontend-dev'],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };

  const agents = [
    createTestAgent('frontend-dev', 'engineering', 'Frontend Developer'),
    createTestAgent('backend-dev', 'engineering', 'Backend Developer'),
  ];

  const filtered = checker.filterAgents(user, agents);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'backend-dev');
});

test('PermissionChecker filters templates by scope', () => {
  const checker = createPermissionChecker();
  const templates = [
    createTestTemplate('tpl1', 'engineering', 'user1'),
    createTestTemplate('tpl2', 'design', 'user1'),
    createTestTemplate('tpl3', 'engineering', 'test-user'),
  ];

  const allAccessUser: UserConfig = {
    id: 'test-user',
    name: 'Test User',
    department: 'engineering',
    clearanceLevel: 'basic',
    allowedAgentIds: [],
    allowedAgentDepartments: [],
    allowedAgentTags: [],
    deniedAgentIds: [],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };

  assert.equal(checker.filterTemplates(allAccessUser, templates).length, 3);

  const deptUser: UserConfig = {
    ...allAccessUser,
    templateAccess: 'department',
  };
  const deptFiltered = checker.filterTemplates(deptUser, templates);
  assert.equal(deptFiltered.length, 2);
  assert.equal(deptFiltered.every((t) => t.department === 'engineering'), true);

  const ownerUser: UserConfig = {
    ...allAccessUser,
    id: 'test-user',
    templateAccess: 'owned',
  };
  const ownerFiltered = checker.filterTemplates(ownerUser, templates);
  assert.equal(ownerFiltered.length, 1);
  assert.equal(ownerFiltered[0]?.owner, 'test-user');

  const noneUser: UserConfig = {
    ...allAccessUser,
    templateAccess: 'none',
  };
  assert.equal(checker.filterTemplates(noneUser, templates).length, 0);
});

test('PermissionChecker checks memory domain access', () => {
  const checker = createPermissionChecker();

  const openUser: UserConfig = {
    id: 'test-user',
    name: 'Test User',
    department: 'engineering',
    clearanceLevel: 'basic',
    allowedAgentIds: [],
    allowedAgentDepartments: [],
    allowedAgentTags: [],
    deniedAgentIds: [],
    templateAccess: 'all',
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: [],
    },
    enabled: true,
  };

  assert.equal(checker.canAccessMemoryDomain(openUser, 'any-domain'), true);

  const restrictedUser: UserConfig = {
    ...openUser,
    memoryAccess: {
      canReadProject: true,
      canReadDecisions: true,
      allowedDomains: ['project-a'],
    },
  };

  assert.equal(checker.canAccessMemoryDomain(restrictedUser, 'project-a'), true);
  assert.equal(checker.canAccessMemoryDomain(restrictedUser, 'project-b'), false);
});

test('UserContextService returns default user when no userId provided', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'));
  const usersFile = path.join(tempDir, 'users.json');

  try {
    const repo = createUserRepository(usersFile);
    const checker = createPermissionChecker();
    const service = createUserContextService(repo, checker);

    const context = service.getCurrentUser();
    assert.notEqual(context, null);
    assert.equal(context?.id, 'user-default');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('UserContextService filters agents by user context', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'));
  const usersFile = path.join(tempDir, 'users.json');

  try {
    const testPolicy = {
      version: '1.0',
      defaultPolicy: 'allowAll' as const,
      users: [
        {
          id: 'engineering-user',
          name: 'Engineering User',
          department: 'engineering',
          clearanceLevel: 'basic' as const,
          allowedAgentIds: [],
          allowedAgentDepartments: ['engineering'],
          allowedAgentTags: [],
          deniedAgentIds: [],
          templateAccess: 'all' as const,
          memoryAccess: {
            canReadProject: true,
            canReadDecisions: true,
            allowedDomains: [],
          },
          enabled: true,
        },
      ],
    };

    fs.writeFileSync(usersFile, JSON.stringify(testPolicy));
    const repo = createUserRepository(usersFile);
    const checker = createPermissionChecker();
    const service = createUserContextService(repo, checker);

    const agents = [
      createTestAgent('frontend-dev', 'engineering', 'Frontend Developer'),
      createTestAgent('backend-dev', 'engineering', 'Backend Developer'),
      createTestAgent('designer', 'design', 'Designer'),
    ];

    const filtered = service.filterAgentsByUser(agents, 'engineering-user');
    assert.equal(filtered.length, 2);
    assert.equal(filtered.every((a) => a.department === 'engineering'), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('UserContextService checks access based on clearance level', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'));
  const usersFile = path.join(tempDir, 'users.json');

  try {
    const testPolicy = {
      version: '1.0',
      defaultPolicy: 'allowAll' as const,
      users: [
        {
          id: 'basic-user',
          name: 'Basic User',
          department: 'engineering',
          clearanceLevel: 'basic' as const,
          allowedAgentIds: [],
          allowedAgentDepartments: [],
          allowedAgentTags: [],
          deniedAgentIds: [],
          templateAccess: 'all' as const,
          memoryAccess: {
            canReadProject: true,
            canReadDecisions: true,
            allowedDomains: [],
          },
          enabled: true,
        },
        {
          id: 'admin-user',
          name: 'Admin User',
          department: 'engineering',
          clearanceLevel: 'admin' as const,
          allowedAgentIds: [],
          allowedAgentDepartments: [],
          allowedAgentTags: [],
          deniedAgentIds: [],
          templateAccess: 'all' as const,
          memoryAccess: {
            canReadProject: true,
            canReadDecisions: true,
            allowedDomains: [],
          },
          enabled: true,
        },
      ],
    };

    fs.writeFileSync(usersFile, JSON.stringify(testPolicy));
    const repo = createUserRepository(usersFile);
    const checker = createPermissionChecker();
    const service = createUserContextService(repo, checker);

    assert.equal(service.checkAccess('basic-user', 'agent', 'read'), true);
    assert.equal(service.checkAccess('basic-user', 'agent', 'delete'), false);
    assert.equal(service.checkAccess('admin-user', 'agent', 'delete'), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
