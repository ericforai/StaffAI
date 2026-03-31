import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import type { TaskRecord, TaskAssignment, WorkflowPlan, TaskType } from '../shared/task-types';
import { runMvpScenario } from '../orchestration/mvp-scenario-runner';
import { getPresetByName } from '../orchestration/mvp-preset';

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
      allowedTaskTypes: [
        'architecture',
        'general',
        'architecture_analysis',
        'backend_design',
        'code_review',
        'documentation',
        'workflow_dispatch',
      ],
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
    getAgent: (id: string) => agents.find((a) => a.id === id) ?? null,
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
    getTasks: async () => [...tasks],
    getTaskById: async (id: string) => tasks.find((t) => t.id === id) || null,
    _getTasks: () => tasks,

    _getAssignments: () => assignments,
    _getWorkflowPlans: () => workflowPlans,
    _getAuditEvents: () => auditEvents,
  } as any;
}

test('Phase 8 MVP Task Types and Context Injection', async (t) => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('code-reviewer'),
    makeMockAgent('technical-writer'),
    makeMockAgent('devops-engineer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const mvpScenarios = [
    {
      presetName: 'architecture_analysis',
      expectedRoles: ['software-architect', 'backend-architect', 'code-reviewer'],
      expectedPaths: ['docs/architecture', 'docs/system-design'],
    },
    {
      presetName: 'backend_design',
      expectedRoles: ['backend-architect', 'software-architect', 'code-reviewer'],
      expectedPaths: ['docs/backend', 'hq/backend/src'],
    },
    {
      presetName: 'code_review',
      expectedRoles: ['code-reviewer', 'software-architect'],
      expectedPaths: ['docs/guidelines', '.github/pull_request_template.md'],
    },
    {
      presetName: 'documentation',
      expectedRoles: ['technical-writer', 'software-architect'],
      expectedPaths: ['docs/user-guides', 'README.md'],
    },
    {
      presetName: 'workflow_dispatch',
      expectedRoles: ['devops-engineer', 'software-architect', 'backend-architect'],
      expectedPaths: ['.github/workflows', 'scripts'],
    },
  ];

  for (const scenario of mvpScenarios) {
    await t.test(`Scenario ${scenario.presetName} activates correct roles and injects context`, async () => {
      const result = await runMvpScenario(
        {
          title: `Testing ${scenario.presetName}`,
          description: 'A test task',
          presetName: scenario.presetName,
        },
        store,
        scanner,
      );

      assert.equal(result.presetUsed.name, scenario.presetName);
      assert.deepEqual(result.presetUsed.roles, scenario.expectedRoles);
      
      // Verify context source injection in description
      for (const path of scenario.expectedPaths) {
        assert.ok(result.task.description.includes(path), `Description should include context path: ${path}`);
      }
      assert.ok(result.task.description.includes('Context Sources:'));
    });
  }
});
