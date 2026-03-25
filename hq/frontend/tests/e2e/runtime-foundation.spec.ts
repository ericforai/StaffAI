import { test, expect, type Page, type Route } from '@playwright/test';

function mockRuntimeApi(page: Page) {
  const hosts = [
    {
      id: 'claude',
      label: 'Claude Code',
      capabilityLevel: 'full',
      supportedExecutors: ['claude', 'codex', 'openai'],
      supportsSampling: true,
      supportsInjection: true,
      supportsRuntimeExecution: true,
      degradation: {
        mode: 'native',
        manualFallback: 'Fallback to generated CLAUDE snippet.',
      },
      injection: {
        targetFile: '.claude/CLAUDE.md',
        strategy: 'append',
        priority: 'primary',
      },
    },
    {
      id: 'codex',
      label: 'Codex',
      capabilityLevel: 'full',
      supportedExecutors: ['codex', 'claude', 'openai'],
      supportsSampling: true,
      supportsInjection: true,
      supportsRuntimeExecution: true,
      degradation: {
        mode: 'native',
        manualFallback: 'Fallback to generated AGENTS snippet.',
      },
      injection: {
        targetFile: '.codex/AGENTS.md',
        strategy: 'append',
        priority: 'primary',
      },
    },
    {
      id: 'gemini',
      label: 'Gemini CLI',
      capabilityLevel: 'partial',
      supportedExecutors: ['openai'],
      supportsSampling: false,
      supportsInjection: false,
      supportsRuntimeExecution: true,
      degradation: {
        mode: 'partial',
        manualFallback: 'Use HQ Web UI when native runtime is unavailable.',
      },
      injection: {
        targetFile: 'GEMINI.md',
        strategy: 'manual',
        priority: 'secondary',
      },
    },
  ];

  return page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const { pathname } = url;

    const json = async () => JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;

    if (pathname === '/api/agents' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'frontend-developer',
            department: 'engineering',
            frontmatter: {
              name: 'Frontend Developer',
              description: 'Builds polished web interfaces.',
            },
          },
          {
            id: 'code-reviewer',
            department: 'engineering',
            frontmatter: {
              name: 'Code Reviewer',
              description: 'Reviews diffs and release quality.',
            },
          },
        ]),
      });
      return;
    }

    if (pathname === '/api/squad' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ activeAgentIds: ['code-reviewer'] }),
      });
      return;
    }

    if (pathname === '/api/squad' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
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

    if (pathname === '/api/task-events' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
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
        body: JSON.stringify({
          runtime: { stateDir: '~/.agency' },
          hosts,
        }),
      });
      return;
    }

    if (pathname === '/api/runtime/discovery' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          capabilities: [
            { id: 'sampling', label: 'Sampling', description: 'Parallel expert sampling' },
            { id: 'host-injection', label: 'Host Injection', description: 'Instruction injection support' },
          ],
        }),
      });
      return;
    }

    if (pathname === '/api/runtime/recommend' && method === 'POST') {
      const payload = await json();
      const hostId = String(payload.hostId || 'codex');
      const recommendations =
        hostId === 'gemini'
          ? [
              {
                action: 'fallback_to_web_ui',
                label: 'Fallback to Web UI',
                reason: 'Current host runtime support is partial.',
              },
            ]
          : [
              {
                action: 'run_expert_discussion',
                label: 'Run expert discussion',
                reason: 'Use active experts before shipping.',
              },
            ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stage: 'review',
          degraded: hostId === 'gemini',
          recommendations,
        }),
      });
      return;
    }

    if (pathname === '/api/mcp/expert-discussion' && method === 'POST') {
      const payload = await json();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          topic: payload.topic || 'runtime discussion',
          degraded: true,
          notice: 'Sampling unavailable, discussion downgraded to serial mode.',
          executor: 'codex',
          participants: [
            {
              id: 'code-reviewer',
              name: 'Code Reviewer',
              description: 'Reviews diffs and release quality.',
              department: 'engineering',
              score: 93,
              isActive: true,
              hiredForTask: false,
              assignment: 'Review runtime panel behavior and fallback UX.',
              response: 'Degraded status should be explicit and actionable.',
            },
          ],
          synthesis: 'Prioritize runtime fallback transparency in the control panel.',
        }),
      });
      return;
    }

    if (pathname === '/api/mcp/find-experts' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          topic: 'runtime',
          experts: [
            {
              id: 'code-reviewer',
              name: 'Code Reviewer',
              description: 'Reviews diffs and release quality.',
              department: 'engineering',
              score: 93,
              isActive: true,
            },
          ],
        }),
      });
      return;
    }

    if (pathname === '/api/mcp/hire-experts' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hired: [], alreadyActive: [], missing: [] }),
      });
      return;
    }

    if (pathname === '/api/mcp/consult-the-agency' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          task: 'runtime check',
          text: 'Use runtime recommendations first.',
          agentId: 'code-reviewer',
          agentName: 'Code Reviewer',
          executor: 'codex',
        }),
      });
      return;
    }

    if (pathname === '/api/mcp/report-task-result' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '任务结果已写入知识库。',
        }),
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
  await mockRuntimeApi(page);
});

test('renders runtime foundation panel and default recommendations', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '专家协作' }).click();

  await expect(page.getByText('宿主能力与降级状态')).toBeVisible();
  await expect(page.getByRole('button', { name: 'codex' })).toBeVisible();
  await expect(page.getByText('Run expert discussion')).toBeVisible();
});

test('switches runtime host and shows degraded recommendations', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '专家协作' }).click();
  await page.getByRole('button', { name: 'gemini' }).click();

  await expect(page.getByText('Fallback to Web UI')).toBeVisible();
  await expect(page.getByText('partial', { exact: true })).toBeVisible();
  await expect(page.getByText('采样 关闭 · 注入 手动')).toBeVisible();
});

test('shows degraded badge and notice after discussion run', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '专家协作' }).click();
  await page
    .getByPlaceholder('描述你希望这场专家讨论解决的问题、目标和限制。')
    .fill('debug runtime degraded behavior before release');
  await page.getByRole('button', { name: '运行讨论' }).click();

  await expect(page.getByText('已降级执行')).toBeVisible();
  await expect(page.getByText('Sampling unavailable, discussion downgraded to serial mode.')).toBeVisible();
  await expect(
    page.locator('section').filter({
      hasText: 'Prioritize runtime fallback transparency in the control panel.',
    }).first()
  ).toBeVisible();
});
