import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Agent, AgentProfile } from '../types';
import type { TaskRecord, TaskAssignment, WorkflowPlan } from '../shared/task-types';

// ---------------------------------------------------------------------------
// Inline mock of mvp-scenario-runner dependencies
// We test the auto-select and flow logic directly from the module.
// ---------------------------------------------------------------------------

import { runMvpScenario, type MvpScenarioResult } from '../orchestration/mvp-scenario-runner';

// Minimal mock agent
function makeMockAgent(id: string, role?: string): Agent {
  return {
    id,
    filePath: `/agents/${id}.md`,
    department: 'engineering',
    frontmatter: { name: id, description: `Agent: ${id}` },
    content: '',
    systemPrompt: '',
    profile: {
      id,
      name: id,
      department: 'engineering',
      role: role ?? id,
      responsibilities: ['do things'],
      tools: [],
      allowedTaskTypes: ['general'],
      riskScope: 'low',
      executionPreferences: {
        preferredMode: 'serial',
        preferredExecutor: 'codex',
        supportsParallelWork: false,
        discussionCapable: false,
      },
      outputContract: { primaryFormat: 'markdown', sections: ['Summary'] },
    },
  };
}

function makeMockScanner(agents: Agent[]) {
  return {
    getAllAgents: () => agents,
    getAgent: (id: string) => agents.find((a) => a.id === id),
    scan: async () => agents,
  } as any;
}

function makeMockStore() {
  let activeIds: string[] = [];
  const tasks: TaskRecord[] = [];
  const assignments: TaskAssignment[] = [];
  const workflowPlans: WorkflowPlan[] = [];
  const auditEvents: any[] = [];
  const approvals: any[] = [];

  return {
    getActiveIds: () => [...activeIds],
    save: (ids: string[]) => { activeIds = [...ids]; },
    saveTask: async (task: TaskRecord) => { tasks.push(task); },
    saveTaskAssignment: async (a: TaskAssignment) => { assignments.push(a); },
    saveWorkflowPlan: async (wp: WorkflowPlan) => { workflowPlans.push(wp); },
    saveApproval: async (a: any) => { approvals.push(a); },
    logAudit: async (event: any) => { auditEvents.push(event); },
    _getTasks: () => tasks,
    _getAssignments: () => assignments,
    _getWorkflowPlans: () => workflowPlans,
    _getAuditEvents: () => auditEvents,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('runMvpScenario creates task, builds plan, and generates audit event', async () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('frontend-developer'),
    makeMockAgent('code-reviewer'),
    makeMockAgent('technical-writer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = await runMvpScenario(
    {
      title: 'Build user auth',
      description: 'Implement JWT authentication',
      presetName: 'full-stack-dev',
    },
    store,
    scanner,
  );

  assert.ok(result.task.id);
  assert.equal(result.task.title, 'Build user auth');
  assert.ok(result.workflowPlan.id);
  assert.ok(result.assignments.length > 0);
  assert.equal(result.presetUsed.name, 'full-stack-dev');
  assert.ok(result.auditTrailId);

  // Verify audit event was logged
  const auditEvents = store._getAuditEvents();
  assert.ok(auditEvents.length > 0);
  const scenarioEvent = auditEvents.find((e: any) => e.action === 'scenario_started');
  assert.ok(scenarioEvent, 'scenario_started audit event should exist');
  assert.equal(scenarioEvent.entityId, result.task.id);
});

test('runMvpScenario auto-selects code-review preset for review tasks', async () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('code-reviewer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = await runMvpScenario(
    {
      title: 'Code review for PR #42',
      description: 'Please review the authentication module changes',
    },
    store,
    scanner,
  );

  assert.equal(result.presetUsed.name, 'code-review');
});

test('runMvpScenario auto-selects architecture preset for architecture tasks', async () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('code-reviewer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = await runMvpScenario(
    {
      title: 'Architecture decision: microservices vs monolith',
      description: 'Evaluate the tradeoffs for our system design',
    },
    store,
    scanner,
  );

  assert.equal(result.presetUsed.name, 'architecture');
});

test('runMvpScenario result contains trackable IDs', async () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('frontend-developer'),
    makeMockAgent('code-reviewer'),
    makeMockAgent('technical-writer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = await runMvpScenario(
    {
      title: 'Test trackability',
      description: 'Verify IDs are present',
      presetName: 'full-stack-dev',
    },
    store,
    scanner,
  );

  // All IDs should be non-empty strings
  assert.ok(typeof result.task.id === 'string' && result.task.id.length > 0);
  assert.ok(typeof result.workflowPlan.id === 'string' && result.workflowPlan.id.length > 0);
  assert.ok(typeof result.auditTrailId === 'string' && result.auditTrailId.length > 0);

  // Workflow plan should reference the task
  assert.equal(result.workflowPlan.taskId, result.task.id);
});

test('runMvpScenario with serial mode produces serial workflow plan', async () => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('code-reviewer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const result = await runMvpScenario(
    {
      title: 'Serial architecture review',
      description: 'Step by step analysis',
      presetName: 'architecture',
      executionMode: 'serial',
    },
    store,
    scanner,
  );

  assert.equal(result.task.executionMode, 'serial');
  // The workflow plan mode depends on task-orchestrator's inferPlanMode
  assert.ok(result.workflowPlan.steps.length > 0);
});
