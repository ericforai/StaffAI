import test from 'node:test';
import assert from 'node:assert/strict';
import type { Agent } from '../types';
import type { TaskRecord, TaskAssignment, WorkflowPlan } from '../shared/task-types';
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
        'general',
        'architecture',
        'backend_implementation',
        'code-review',
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
    _getTasks: () => tasks,
    _getAssignments: () => assignments,
    _getWorkflowPlans: () => workflowPlans,
    _getAuditEvents: () => auditEvents,
  } as any;
}

test('MVP scenarios map to the current preset registry and generate runnable plans', async (t) => {
  const agents = [
    makeMockAgent('software-architect'),
    makeMockAgent('backend-architect'),
    makeMockAgent('frontend-developer'),
    makeMockAgent('code-reviewer'),
    makeMockAgent('technical-writer'),
  ];
  const store = makeMockStore();
  const scanner = makeMockScanner(agents);

  const scenarios = [
    {
      presetName: 'architecture',
      title: 'Architecture review',
      description: 'Evaluate service boundaries and tradeoffs',
      expectedRoles: ['software-architect', 'backend-architect', 'code-reviewer'],
    },
    {
      presetName: 'code-review',
      title: 'Review authentication changes',
      description: 'Audit the PR for regressions',
      expectedRoles: ['code-reviewer', 'software-architect'],
    },
    {
      presetName: 'full-stack-dev',
      title: 'Build user auth',
      description: 'Implement login flow and supporting docs',
      expectedRoles: [
        'software-architect',
        'backend-architect',
        'frontend-developer',
        'code-reviewer',
        'technical-writer',
      ],
    },
  ];

  for (const scenario of scenarios) {
    await t.test(`Scenario for ${scenario.presetName} uses the expected preset`, async () => {
      const result = await runMvpScenario(
        {
          title: scenario.title,
          description: scenario.description,
          presetName: scenario.presetName,
        },
        store,
        scanner,
      );

      const preset = getPresetByName(scenario.presetName);
      assert.ok(preset, `Preset ${scenario.presetName} should exist`);
      assert.equal(result.presetUsed.name, scenario.presetName);
      assert.deepEqual(result.presetUsed.roles, scenario.expectedRoles);
      assert.ok(preset.defaultContextPaths.length > 0);
      assert.equal(result.task.title, scenario.title);
      assert.equal(result.workflowPlan.taskId, result.task.id);
      assert.ok(result.assignments.length > 0);
    });
  }
});
