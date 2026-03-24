import { test, expect, type Page, type Route } from '@playwright/test';

function mockTaskWorkspaceApi(page: Page) {
  const tasks = [
    {
      id: 'task-1',
      title: 'Refactor server composition',
      description: 'Split route registration from domain logic',
      status: 'completed',
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
    executions: [] as Array<{ id: string; taskId: string; status: string; executor: string; outputSummary: string }>,
  };

  return page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const method = route.request().method();

    if (pathname === '/api/agents' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (pathname === '/api/squad' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ activeAgentIds: [] }),
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

    if (pathname === '/api/tasks/task-1/execute' && method === 'POST') {
      taskDetail.task.status = 'completed';
      taskDetail.executions = [
        {
          id: 'execution-1',
          taskId: 'task-1',
          status: 'completed',
          executor: 'codex',
          outputSummary: 'Execution finished from the task workspace',
        },
      ];
      taskEvents.unshift({
        type: 'TASK_EVENT',
        taskEventType: 'execution_completed',
        message: '执行已完成：execution-1',
        taskId: 'task-1',
        executionId: 'execution-1',
        timestamp: '2026-03-24T00:00:01.000Z',
      });

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
          execution: taskDetail.executions[0] || {
            id: 'execution-1',
            taskId: 'task-1',
            status: 'completed',
            executor: 'codex',
            outputSummary: 'Execution finished cleanly',
          },
        }),
      });
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
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `No mock for ${method} ${pathname}` }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockTaskWorkspaceApi(page);
});

test('dashboard exposes links to the new workspaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /任务工作区/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /审批队列/ })).toBeVisible();
  await expect(page.getByText('最新事件：任务已创建 · 任务已创建：Refactor server composition')).toBeVisible();
});

test('task workspace can execute a task and open execution detail', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.getByText('任务列表')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Refactor server composition' })).toBeVisible();
  await expect(page.getByText('最新事件：任务已创建：Refactor server composition')).toBeVisible();

  await page.getByRole('link', { name: 'Refactor server composition Split route registration from domain logic completed single' }).click();
  await expect(page.getByRole('heading', { name: '任务详情' })).toBeVisible();
  await expect(page.getByText('software-architect')).toBeVisible();
  await page.getByRole('button', { name: '执行任务' }).click();
  await expect(page.getByText('Execution finished from the task workspace').first()).toBeVisible();

  await page.getByRole('link', { name: '查看', exact: true }).click();
  await expect(page.getByRole('heading', { name: '执行详情' })).toBeVisible();
  await expect(page.getByText('Execution finished from the task workspace')).toBeVisible();
  await expect(page.getByText('执行器')).toBeVisible();
  await expect(page.getByText('codex')).toBeVisible();
});

test('task workspace can create a new task', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByPlaceholder('任务标题').fill('Create approval dashboard');
  await page.getByPlaceholder('任务描述').fill('Track approvals in the multi-page workspace');
  await page.getByRole('button', { name: '创建任务' }).click();

  await expect(page.getByText('Create approval dashboard')).toBeVisible();
});

test('task workspace filters actionable work', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByRole('button', { name: '待执行', exact: true }).click();
  await expect(page.getByText('当前筛选没有可执行任务', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '全部任务', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Refactor server composition' })).toBeVisible();
});

test('approval queue renders and can approve an item', async ({ page }) => {
  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: 'Queue snapshot' })).toBeVisible();
  await expect(page.getByText('Next pending approval')).toBeVisible();
  await expect(page.getByText('审批列表')).toBeVisible();
  await expect(page.getByText('approval-1')).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'task-risky' })).toBeVisible();
  await expect(page.getByText('pending', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All statuses' })).toBeVisible();
  await page.getByRole('button', { name: '批准' }).click();
  await expect(page.getByText('approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pending only' }).click();
  await expect(page.getByText('No approvals match the selected filter.')).toBeVisible();
  await page.getByRole('button', { name: 'Approved only' }).click();
  await expect(page.getByText('approved', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'task-risky' }).click();
  await expect(page.getByRole('heading', { name: '任务详情' })).toBeVisible();
});

test('task workspace renders explicit error state and retry affordance', async ({ page }) => {
  await page.route('**/api/tasks', async (route) => {
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

  await page.goto('/tasks');
  await expect(page.getByTestId('tasks-error-state')).toBeVisible();
  await expect(page.getByText('Task workspace is temporarily unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible();
});

test('execution detail renders empty state for missing execution records', async ({ page }) => {
  await page.route('**/api/executions/missing-execution', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'execution not found' }),
    });
  });

  await page.goto('/executions/missing-execution');
  await expect(page.getByTestId('execution-detail-empty-state')).toBeVisible();
  await expect(page.getByText('执行记录不存在')).toBeVisible();
  await expect(page.getByTestId('execution-detail-empty-state').getByRole('link', { name: '返回任务工作区' })).toBeVisible();
});

test('execution detail renders retryable error state for backend failures', async ({ page }) => {
  await page.route('**/api/executions/execution-error', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Execution detail service failed' }),
    });
  });

  await page.goto('/executions/execution-error');
  await expect(page.getByTestId('execution-detail-error-state')).toBeVisible();
  await expect(page.getByText('Execution detail service failed')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible();
});
