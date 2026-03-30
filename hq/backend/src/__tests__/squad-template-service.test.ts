import test from 'node:test';
import assert from 'node:assert/strict';
import { createSquadTemplateService, type AvailableAgent } from '../orchestration/squad-template-service';
import type { Agent } from '../types';

// --- Mock agents for testing ---

const mockEngineeringAgent1: Agent = {
  id: 'architect',
  filePath: '/agents/architect.md',
  department: 'engineering',
  frontmatter: {
    name: 'Architect',
    description: 'Architecture and backend design specialist',
  },
  content: '',
  systemPrompt: '',
  profile: {
    id: 'architect',
    name: 'Architect',
    department: 'engineering',
    role: 'architect',
    responsibilities: ['architecture'],
    tools: [],
    allowedTaskTypes: ['architecture', 'architecture_analysis', 'backend_design', 'frontend_implementation'],
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

const mockEngineeringAgent2: Agent = {
  id: 'backend-dev',
  filePath: '/agents/backend-dev.md',
  department: 'engineering',
  frontmatter: {
    name: 'Backend Developer',
    description: 'Backend implementation and code review',
  },
  content: '',
  systemPrompt: '',
  profile: {
    id: 'backend-dev',
    name: 'Backend Developer',
    department: 'engineering',
    role: 'developer',
    responsibilities: ['implementation'],
    tools: [],
    allowedTaskTypes: ['backend_implementation', 'frontend_implementation', 'code_review'],
    riskScope: 'low',
    executionPreferences: {
      preferredMode: 'single',
      preferredExecutor: 'claude',
      supportsParallelWork: false,
      discussionCapable: false,
    },
    outputContract: {
      primaryFormat: 'code',
      sections: [],
    },
  },
};

const mockTestingAgent: Agent = {
  id: 'qa-engineer',
  filePath: '/agents/qa-engineer.md',
  department: 'testing',
  frontmatter: {
    name: 'QA Engineer',
    description: 'Code review and quality assurance',
  },
  content: '',
  systemPrompt: '',
  profile: {
    id: 'qa-engineer',
    name: 'QA Engineer',
    department: 'testing',
    role: 'tester',
    responsibilities: ['testing'],
    tools: [],
    allowedTaskTypes: ['code_review', 'quality_assurance'],
    riskScope: 'low',
    executionPreferences: {
      preferredMode: 'single',
      preferredExecutor: 'claude',
      supportsParallelWork: false,
      discussionCapable: false,
    },
    outputContract: {
      primaryFormat: 'checklist',
      sections: [],
    },
  },
};

const mockMarketingAgent: Agent = {
  id: 'content-writer',
  filePath: '/agents/content-writer.md',
  department: 'marketing',
  frontmatter: {
    name: 'Content Writer',
    description: 'Documentation and general content',
  },
  content: '',
  systemPrompt: '',
  profile: {
    id: 'content-writer',
    name: 'Content Writer',
    department: 'marketing',
    role: 'writer',
    responsibilities: ['writing'],
    tools: [],
    allowedTaskTypes: ['documentation', 'general'],
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

function makeGetAgent(agents: Agent[]): (id: string) => Agent | undefined {
  const map = new Map(agents.map((a) => [a.id, a]));
  return (id: string) => map.get(id);
}

// --- Tests ---

test('getTemplate returns template by name', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });
  const template = service.getTemplate('dev_team');

  assert.ok(template);
  assert.equal(template.name, 'dev_team');
  assert.ok(template.description.length > 0);
  assert.ok(template.roles.length > 0);
});

test('getTemplate returns undefined for unknown template', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });
  assert.equal(service.getTemplate('nonexistent_template'), undefined);
});

test('listTemplates returns all templates', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });
  const templates = service.listTemplates();

  assert.ok(templates.length >= 3, 'Expected at least 3 built-in templates');
  const names = templates.map((t) => t.name);
  assert.ok(names.includes('dev_team'));
  assert.ok(names.includes('research_team'));
  assert.ok(names.includes('review_team'));
});

test('resolveSquad assigns matching agents for dev_team', () => {
  const allAgents = [mockEngineeringAgent1, mockEngineeringAgent2, mockTestingAgent];
  const service = createSquadTemplateService({ getAgent: makeGetAgent(allAgents) });

  const availableAgents: AvailableAgent[] = allAgents.map((a) => ({
    id: a.id,
    name: a.frontmatter.name,
    department: a.department,
  }));

  const result = service.resolveSquad('dev_team', availableAgents);

  assert.equal(result.members.length, 3, 'All 3 roles should be filled');

  // Commander should be architect (engineering, has architecture task types)
  const commander = result.members.find((m) => m.role === 'commander');
  assert.ok(commander);
  assert.equal(commander.agentId, 'architect');

  // Executor should be backend-dev (engineering, has implementation task types)
  const executor = result.members.find((m) => m.role === 'executor');
  assert.ok(executor);
  assert.equal(executor.agentId, 'backend-dev');

  // Critic should be qa-engineer (testing, has code_review and quality_assurance)
  const critic = result.members.find((m) => m.role === 'critic');
  assert.ok(critic);
  assert.equal(critic.agentId, 'qa-engineer');
});

test('resolveSquad returns unfilled roles when no matching agents', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([mockMarketingAgent]) });

  const availableAgents: AvailableAgent[] = [
    { id: 'content-writer', name: 'Content Writer', department: 'marketing' },
  ];

  const result = service.resolveSquad('dev_team', availableAgents);

  // Dev team needs engineering and testing agents, but only marketing is available
  assert.ok(result.unfilledRoles.length > 0, 'Should have unfilled roles');
  assert.ok(result.members.length === 0, 'No roles should be filled since no matching department');
});

test('resolveSquad returns empty for unknown template', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });

  const result = service.resolveSquad('nonexistent_template', []);

  assert.equal(result.members.length, 0);
  assert.equal(result.unfilledRoles.length, 0);
});

test('resolveSquad does not assign the same agent to multiple roles', () => {
  // Only one engineering agent and one testing agent
  const allAgents = [mockEngineeringAgent1, mockTestingAgent];
  const service = createSquadTemplateService({ getAgent: makeGetAgent(allAgents) });

  const availableAgents: AvailableAgent[] = allAgents.map((a) => ({
    id: a.id,
    name: a.frontmatter.name,
    department: a.department,
  }));

  const result = service.resolveSquad('review_team', availableAgents);

  // review_team has two engineering roles and one testing role
  // Only one engineering agent available, so one role should be unfilled
  const assignedIds = result.members.map((m) => m.agentId);
  const uniqueIds = new Set(assignedIds);
  assert.equal(assignedIds.length, uniqueIds.size, 'No agent should be assigned twice');
});

test('resolveSquad with empty available agents returns all unfilled', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });

  const result = service.resolveSquad('dev_team', []);

  assert.equal(result.members.length, 0);
  assert.equal(result.unfilledRoles.length, 3, 'All 3 dev_team roles should be unfilled');
});

test('resolveSquad ignores agents that getAgent returns undefined for', () => {
  const service = createSquadTemplateService({
    getAgent: () => undefined,
  });

  const availableAgents: AvailableAgent[] = [
    { id: 'ghost-agent', name: 'Ghost', department: 'engineering' },
  ];

  const result = service.resolveSquad('dev_team', availableAgents);
  assert.equal(result.members.length, 0);
});

test('listTemplates each have valid roles with department and taskTypes', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });
  const templates = service.listTemplates();

  for (const template of templates) {
    assert.ok(template.roles.length > 0, `Template ${template.name} should have roles`);
    for (const role of template.roles) {
      assert.ok(role.role, `Role in ${template.name} should have a role name`);
      assert.ok(role.department, `Role in ${template.name} should have a department`);
      assert.ok(role.taskTypes.length > 0, `Role ${role.role} in ${template.name} should have taskTypes`);
    }
  }
});

test('getTemplate returns research_team with correct structure', () => {
  const service = createSquadTemplateService({ getAgent: makeGetAgent([]) });
  const template = service.getTemplate('research_team');

  assert.ok(template);
  assert.equal(template.roles.length, 3);
  assert.equal(template.roles[0].department, 'project-management');
  assert.equal(template.roles[1].department, 'marketing');
  assert.equal(template.roles[2].department, 'paid-media');
});
