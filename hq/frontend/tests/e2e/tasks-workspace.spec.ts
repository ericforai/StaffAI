import { test, expect, type Page, type Route } from '@playwright/test';

// Client calls the backend on port 3333 (see getDefaultApiUrl). Match full URL — not only same-origin.
const AGENCY_API_URL_RE = /http:\/\/(127\.0\.0\.1|localhost):3333\/api\//;

function mockTaskWorkspaceApi(page: Page) {
  const tasks = [
    {
      id: 'task-1',
      title: 'Refactor server composition',
      description: 'Split route registration from domain logic',
      status: 'created',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      recommendedAgentRole: 'software-architect',
      routingStatus: 'matched',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
    },
  ];
  const approvals = [
    {
      id: 'approval-1',
      taskId: 'task-risky',
      status: 'pending',
      requestedBy: 'system',
      requestedAt: '2026-03-24T00:00:00.000Z',
    },
  ];
  const taskEvents = [
    {
      type: 'TASK_EVENT',
      taskEventType: 'task_created',
      message: '任务已创建：Refactor server composition',
      taskId: 'task-1',
      timestamp: '2026-03-24T00:00:00.000Z',
    },
  ];

  const taskDetail = {
    task: {
      id: 'task-1',
      title: 'Refactor server composition',
      description: 'Split route registration from domain logic',
      status: 'created',
      executionMode: 'single',
      approvalRequired: false,
      riskLevel: 'low',
      recommendedAgentRole: 'software-architect',
      routingStatus: 'matched',
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
    },
    approvals: [] as Array<{ id: string; taskId: string; status: string; requestedBy: string; requestedAt: string }>,
    executions: [] as Array<{
      id: string;
      taskId: string;
      status: string;
      executor: string;
      outputSummary: string;
      startedAt?: string;
    }>,
  };

  const mockAgents = [
    {
      id: 'e2e-architect',
      department: 'engineering',
      frontmatter: {
        name: 'E2E Mock Architect',
        description: 'Used by Playwright to satisfy assignee selection.',
      },
    },
  ];

  return page.route(AGENCY_API_URL_RE, async (route: Route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const method = route.request().method();

    // Allow individual tests to override these endpoints with a more specific route.
    // Do not fallback GET /api/tasks — the default mock must serve the task list.
    if (
      method === 'GET' &&
      (pathname === '/api/executions/missing-execution' ||
        pathname === '/api/executions/execution-error' ||
        pathname === '/api/executions/execution-failed')
    ) {
      await route.fallback();
      return;
    }

    if (
      pathname.startsWith('/api/executions/') &&
      pathname.endsWith('/trace') &&
      pathname !== '/api/executions/execution-1/trace' &&
      method === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trace: { traceEvents: [], costLogs: [] } }),
      });
      return;
    }

    if (pathname === '/api/agents' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAgents),
      });
      return;
    }

    if (pathname === '/api/squad' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ activeAgentIds: ['e2e-architect'] }),
      });
      return;
    }

    if (pathname === '/api/templates' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (pathname === '/api/mcp/capabilities' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ capabilities: { sampling: true } }),
      });
      return;
    }

    if (pathname === '/api/runtime/hosts' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runtime: { stateDir: '~/.agency' }, hosts: [] }),
      });
      return;
    }

    if (pathname === '/api/runtime/discovery' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ capabilities: [] }),
      });
      return;
    }

    if (pathname === '/api/runtime/recommend' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ recommendations: [] }),
      });
      return;
    }

    if (pathname === '/api/tasks' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks,
        }),
      });
      return;
    }

    if (pathname === '/api/tasks' && method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}') as Record<string, string>;
      const createdTask = {
        id: 'task-created',
        title: payload.title || 'Untitled',
        description: payload.description || '',
        status: 'created',
        executionMode: payload.executionMode || 'single',
        approvalRequired: false,
        riskLevel: 'low',
        recommendedAgentRole: 'software-architect',
        routingStatus: 'matched',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      };
      tasks.unshift(createdTask);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          task: createdTask,
          stage: 'sprint-1-skeleton',
        }),
      });
      return;
    }

    if (pathname === '/api/tasks/task-1' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(taskDetail),
      });
      return;
    }

    if (pathname === '/api/tasks/task-risky' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          task: {
            id: 'task-risky',
            title: 'Risky task',
            description: 'A high risk task waiting for approval',
            status: 'waiting_approval',
            executionMode: 'serial',
            approvalRequired: true,
            riskLevel: 'high',
            recommendedAgentRole: 'software-architect',
            routingStatus: 'matched',
            createdAt: '2026-03-24T00:00:00.000Z',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
          approvals: approvals.filter((approval) => approval.taskId === 'task-risky'),
          executions: [],
        }),
      });
      return;
    }

    if (pathname === '/api/tasks/task-1/execute' && method === 'POST') {
      tasks[0] = {
        ...tasks[0],
        status: 'completed',
      };
      taskDetail.task.status = 'completed';
      taskDetail.executions = [
        {
          id: 'execution-1',
          taskId: 'task-1',
          status: 'completed',
          executor: 'codex',
          outputSummary: 'Execution finished from the task workspace',
          startedAt: '2026-03-24T00:00:00.000Z',
        },
      ];
      taskEvents.unshift({
        type: 'TASK_EVENT',
        taskEventType: 'execution_completed',
        message: '执行已完成：execution-1',
        taskId: 'task-1',
        executionId: 'execution-1',
        timestamp: '2026-03-24T00:00:01.000Z',
      } as any);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'single',
          execution: taskDetail.executions[0],
          task: taskDetail.task,
        }),
      });
      return;
    }

    if (pathname === '/api/executions/execution-1' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          execution: {
            ...(taskDetail.executions[0] || {
              id: 'execution-1',
              taskId: 'task-1',
              status: 'completed',
              executor: 'codex',
              outputSummary: 'Execution finished cleanly',
            }),
            toolCalls: [
              {
                id: 'toolcall-1',
                toolName: 'file_read',
                status: 'completed',
                riskLevel: 'low',
                actorRole: 'backend-developer',
                inputSummary: 'path=package.json',
                outputSummary: 'read ok',
                createdAt: '2026-03-24T00:00:01.000Z',
              },
            ],
            controlState: { executionId: 'execution-1', status: 'completed', taskId: 'task-1' },
          },
        }),
      });
      return;
    }

    if (pathname === '/api/executions/execution-1/trace' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          trace: {
            execution: { id: 'execution-1', taskId: 'task-1', status: 'completed' },
            traceEvents: [
              { id: 'evt-1', type: 'execution_started', occurredAt: '2026-03-24T00:00:00.500Z', summary: 'Execution started' },
              { id: 'evt-2', type: 'tool_call_logged', occurredAt: '2026-03-24T00:00:00.800Z', summary: 'Tool call completed' },
              { id: 'evt-3', type: 'execution_completed', occurredAt: '2026-03-24T00:00:01.000Z', summary: 'Execution completed' },
            ],
            costLogs: [{ id: 'cost-1', recordedAt: '2026-03-24T00:00:01.000Z', tokensUsed: 123 }],
          },
        }),
      });
      return;
    }

    if (pathname === '/api/executions/execution-1/pause' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    if (pathname === '/api/executions/execution-1/resume' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    if (pathname === '/api/executions/execution-1/cancel' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }

    if (pathname === '/api/approvals' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          approvals,
        }),
      });
      return;
    }

    if (pathname === '/api/task-events' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: taskEvents,
        }),
      });
      return;
    }

    if (pathname === '/api/approvals/approval-1/approve' && method === 'POST') {
      approvals[0] = { ...approvals[0], status: 'approved' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          approval: approvals[0],
        }),
      });
      return;
    }

    if (pathname === '/api/approvals/approval-1/reject' && method === 'POST') {
      approvals[0] = { ...approvals[0], status: 'rejected' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          approval: approvals[0],
        }),
      });
      return;
    }

    if (pathname.startsWith('/api/mcp/') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockTaskWorkspaceApi(page);
});

test('dashboard exposes links to the new workspaces', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('aside').getByRole('link', { name: '工作任务' }).click();
  await expect(page.getByRole('heading', { name: '发起新任务' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Refactor server composition' })).toBeVisible();
  await expect(page.locator('aside').getByRole('link', { name: '专家协作' })).toBeVisible();
  await page.getByRole('heading', { name: 'Refactor server composition' }).click();
  await expect(page).toHaveURL(/\/tasks\/task-1$/);
  await page.getByRole('button', { name: '执行任务' }).click();
  await expect(page.getByText('Execution finished from the task workspace').first()).toBeVisible();
});

test('delivery lighthouse hero shows approval focus when pending approvals exist', async ({ page }) => {
  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('delivery-lighthouse-hero')).toBeVisible();
  await expect(page.getByTestId('delivery-current')).toContainText('审批');
  await expect(page.getByTestId('delivery-blocker')).toContainText('待处理审批');
  await expect(page.getByTestId('delivery-primary-cta')).toContainText('前往审批');
});

test('advanced wizard shows step rail and completion hint', async ({ page }) => {
  await page.goto('/tasks?mode=advanced', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('intent-wizard-steps')).toBeVisible();
  await expect(page.getByTestId('intent-step-completion-hint')).toContainText('完成条件');
});

test('task detail shows delivery approval banner when task waits for approval', async ({ page }) => {
  await page.goto('/tasks/task-risky', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('delivery-approval-banner')).toBeVisible();
  await expect(page.getByTestId('delivery-approval-banner').getByRole('link', { name: '前往审批队列' })).toBeVisible();
});

test('task workspace can execute a task and open execution detail', async ({ page }) => {
  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByRole('heading', { name: '发起新任务' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Refactor server composition' })).toBeVisible();
  await expect(page.getByText('最新事件：任务已创建：Refactor server composition')).toBeVisible();

  await page.goto('/tasks/task-1', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page).toHaveURL(/\/tasks\/task-1$/);
  await expect(page.getByRole('heading', { name: '任务指挥台' })).toBeVisible();
  await expect(page.getByText('software-architect')).toBeVisible();
  await page.getByRole('button', { name: '执行任务' }).click();
  await expect(page.getByText('Execution finished from the task workspace').first()).toBeVisible();

  await page.goto('/executions/execution-1', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByRole('heading', { name: '执行详情' })).toBeVisible();
  await expect(page.getByText('Execution finished from the task workspace')).toBeVisible();
  await expect(page.getByText('执行器')).toBeVisible();
  await expect(page.getByText('Codex')).toBeVisible();

  await expect(page.getByTestId('execution-toolcalls')).toBeVisible();
  await expect(page.getByTestId('toolcall-card-toolcall-1')).toBeVisible();
  await expect(page.getByTestId('execution-trace-events')).toBeVisible();
});

test('task workspace can create a new task', async ({ page }) => {
  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('button', { name: '请选择负责人' }).click();
  await page.getByRole('button', { name: /工程部/ }).click();
  await page.getByRole('button', { name: 'E2E Mock Architect' }).click();
  await page.getByPlaceholder('任务标题').fill('Create approval dashboard');
  await page.getByPlaceholder('任务描述').fill('Track approvals in the multi-page workspace');
  await page.getByRole('button', { name: '创建任务' }).click();
  await page.getByRole('button', { name: '稍后执行' }).click();

  await expect(page.getByRole('heading', { name: 'Create approval dashboard' })).toBeVisible();
});

test('task workspace filters actionable work', async ({ page }) => {
  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('button', { name: '待执行', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Refactor server composition' })).toBeVisible();
  await page.getByRole('button', { name: '全部任务', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Refactor server composition' })).toBeVisible();
});

test('approval queue renders and can approve an item', async ({ page }) => {
  await page.goto('/approvals', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByRole('heading', { name: '队列快照' })).toBeVisible();
  await expect(page.getByText('下一条待处理审批')).toBeVisible();
  await expect(page.getByText('审批概览')).toBeVisible();
  await expect(page.getByText('approval-1')).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'task-risky' })).toBeVisible();
  await expect(page.getByText('待处理', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '全部状态' })).toBeVisible();
  await page.getByRole('button', { name: '批准', exact: true }).click();
  await expect(page.getByText('已批准', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '只看待处理' }).click();
  await expect(page.getByText('当前筛选下没有匹配的审批记录。')).toBeVisible();
  await page.getByRole('button', { name: '只看已批准' }).click();
  await expect(page.getByText('已批准', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'task-risky' }).click();
  await expect(page.getByRole('heading', { name: '任务指挥台' })).toBeVisible();
});

test('task workspace renders explicit error state and retry affordance', async ({ page }) => {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):3333\/api\/tasks$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Task workspace is temporarily unavailable' }),
    });
  });

  await page.goto('/tasks', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('tasks-error-state')).toBeVisible();
  await expect(page.getByText('Task workspace is temporarily unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible();
});

test('execution detail renders empty state for missing execution records', async ({ page }) => {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):3333\/api\/executions\/missing-execution$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ execution: null }),
    });
  });

  await page.goto('/executions/missing-execution', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('execution-detail-empty-state')).toBeVisible();
  await expect(page.getByText('执行记录不存在')).toBeVisible();
  await expect(page.getByTestId('execution-detail-empty-state').getByRole('link', { name: '返回任务工作区' })).toBeVisible();
});

test('execution detail renders retryable error state for backend failures', async ({ page }) => {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):3333\/api\/executions\/execution-error$/, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Execution detail service failed' }),
    });
  });

  await page.goto('/executions/execution-error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('execution-detail-error-state')).toBeVisible();
  await expect(page.getByText('Execution detail service failed')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible();
});

test('execution detail surfaces failed execution reasons from the backend payload', async ({ page }) => {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):3333\/api\/executions\/execution-failed(\/trace)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/trace')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trace: { traceEvents: [], costLogs: [] } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        execution: {
          id: 'execution-failed',
          taskId: 'task-1',
          status: 'failed',
          executor: 'codex',
          outputSummary: 'Execution stopped before completion',
          errorMessage: 'Codex CLI exited with code 1 after the workspace bootstrap step.',
          startedAt: '2026-03-24T00:00:00.000Z',
          completedAt: '2026-03-24T00:01:00.000Z',
        },
      }),
    });
  });

  await page.goto('/executions/execution-failed', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByRole('heading', { name: '执行详情' })).toBeVisible();
  await expect(page.getByText('失败', { exact: true })).toBeVisible();
  await expect(page.getByText('失败原因')).toBeVisible();
  await expect(page.getByText('Codex CLI exited with code 1 after the workspace bootstrap step.')).toBeVisible();
});
