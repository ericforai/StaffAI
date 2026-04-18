import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type express from 'express';
import { registerEliteRoutes } from '../api/elite';
import * as eliteRepo from '../persistence/elite-repositories';

type RouteRequest = {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  userContext?: { id: string; clearanceLevel: 'basic' | 'senior' | 'admin' } | null;
};

type RouteHandler = (req: RouteRequest, res: MockResponse) => Promise<void> | void;

class MockResponse {
  public statusCode = 200;
  public payload: unknown;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown) {
    this.payload = payload;
    return this;
  }
}

function createMockApp() {
  const handlers = new Map<string, RouteHandler>();
  return {
    handlers,
    get(route: string, handler: RouteHandler) {
      handlers.set(`GET ${route}`, handler);
      return this;
    },
    post(route: string, handler: RouteHandler) {
      handlers.set(`POST ${route}`, handler);
      return this;
    },
    put(route: string, handler: RouteHandler) {
      handlers.set(`PUT ${route}`, handler);
      return this;
    },
    delete(route: string, handler: RouteHandler) {
      handlers.set(`DELETE ${route}`, handler);
      return this;
    },
  } as unknown as express.Application & { handlers: Map<string, RouteHandler> };
}

async function invoke(
  handlers: Map<string, RouteHandler>,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  route: string,
  req: RouteRequest = {},
) {
  const handler = handlers.get(`${method} ${route}`);
  assert.ok(handler, `missing handler for ${method} ${route}`);
  const res = new MockResponse();
  await handler(
    {
      params: {},
      query: {},
      body: {},
      headers: {},
      userContext: null,
      ...req,
    },
    res,
  );
  return res;
}

const sampleSkill = {
  id: 'elite-sales',
  name: 'Elite Sales',
  description: 'Close deals',
  version: '1.0.0',
  expert: { name: 'Alice', department: 'sales', title: 'Lead' },
  category: 'sales',
  tags: ['sales'],
  status: 'pending' as const,
  installCount: 0,
  createdAt: '2026-04-18T00:00:00.000Z',
  updatedAt: '2026-04-18T00:00:00.000Z',
  createdBy: 'admin-user',
  filePath: 'elite-skills/skills/elite-sales/SKILL.md',
};

const originalListAllSkills = eliteRepo.listAllSkills;
const originalCreateSkill = eliteRepo.createSkill;
const originalUpdateSkill = eliteRepo.updateSkill;
const originalDeleteSkill = eliteRepo.deleteSkill;
const originalPublishSkill = eliteRepo.publishSkill;
const originalDeprecateSkill = eliteRepo.deprecateSkill;
const originalFetch = global.fetch;
const repoMock = eliteRepo as {
  listAllSkills: typeof eliteRepo.listAllSkills;
  createSkill: typeof eliteRepo.createSkill;
  updateSkill: typeof eliteRepo.updateSkill;
  deleteSkill: typeof eliteRepo.deleteSkill;
  publishSkill: typeof eliteRepo.publishSkill;
  deprecateSkill: typeof eliteRepo.deprecateSkill;
};

afterEach(() => {
  repoMock.listAllSkills = originalListAllSkills;
  repoMock.createSkill = originalCreateSkill;
  repoMock.updateSkill = originalUpdateSkill;
  repoMock.deleteSkill = originalDeleteSkill;
  repoMock.publishSkill = originalPublishSkill;
  repoMock.deprecateSkill = originalDeprecateSkill;
  global.fetch = originalFetch;
});

test('elite admin endpoints reject non-admin users and allow admin users', async () => {
  const app = createMockApp();
  repoMock.listAllSkills = async () => [sampleSkill];
  repoMock.createSkill = async () => sampleSkill;
  repoMock.updateSkill = async () => sampleSkill;
  repoMock.deleteSkill = async () => true;
  repoMock.publishSkill = async () => ({ ...sampleSkill, status: 'published' });
  repoMock.deprecateSkill = async () => ({ ...sampleSkill, status: 'deprecated' });

  registerEliteRoutes(app, {});

  const routes: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    route: string;
    request?: RouteRequest;
    expectedStatus: number;
  }> = [
    { method: 'GET', route: '/api/elite/skills/all', expectedStatus: 200 },
    {
      method: 'POST',
      route: '/api/elite/skills',
      expectedStatus: 201,
      request: {
        body: {
          name: 'Elite Sales',
          description: 'Close deals',
          expert: { name: 'Alice', department: 'sales', title: 'Lead' },
          category: 'sales',
          tags: ['sales'],
          content: '# Elite Sales',
        },
      },
    },
    {
      method: 'PUT',
      route: '/api/elite/skills/:id',
      expectedStatus: 200,
      request: { params: { id: 'elite-sales' }, body: { description: 'Updated' } },
    },
    {
      method: 'DELETE',
      route: '/api/elite/skills/:id',
      expectedStatus: 200,
      request: { params: { id: 'elite-sales' } },
    },
    {
      method: 'POST',
      route: '/api/elite/skills/:id/publish',
      expectedStatus: 200,
      request: { params: { id: 'elite-sales' } },
    },
    {
      method: 'POST',
      route: '/api/elite/skills/:id/deprecate',
      expectedStatus: 200,
      request: { params: { id: 'elite-sales' } },
    },
  ];

  for (const route of routes) {
    const forbidden = await invoke(app.handlers, route.method, route.route, route.request);
    assert.equal(forbidden.statusCode, 403, `${route.method} ${route.route} should reject non-admin users`);

    const allowed = await invoke(app.handlers, route.method, route.route, {
      ...route.request,
      userContext: { id: 'admin-user', clearanceLevel: 'admin' },
    });
    assert.equal(allowed.statusCode, route.expectedStatus, `${route.method} ${route.route} should allow admin users`);
  }
});

test('elite import rejects non-github URLs before any fetch happens', async () => {
  const app = createMockApp();
  let fetchCalled = false;
  global.fetch = (async () => {
    fetchCalled = true;
    throw new Error('should not fetch');
  }) as typeof fetch;

  registerEliteRoutes(app, {});

  const response = await invoke(app.handlers, 'GET', '/api/elite/skills/import', {
    query: { url: 'https://example.com/skill.md' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(fetchCalled, false);
});

test('elite import supports github repository URLs with root SKILL.md', async () => {
  const app = createMockApp();
  const requestedUrls: string[] = [];

  global.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === 'https://api.github.com/repos/acme/elite-skill') {
      return new Response(JSON.stringify({ full_name: 'acme/elite-skill' }), { status: 200 });
    }
    if (url === 'https://api.github.com/repos/acme/elite-skill/contents') {
      return new Response(JSON.stringify([
        { name: 'SKILL.md', download_url: 'https://raw.githubusercontent.com/acme/elite-skill/main/SKILL.md' },
      ]), { status: 200 });
    }
    if (url === 'https://raw.githubusercontent.com/acme/elite-skill/main/SKILL.md') {
      return new Response('---\nname: "Elite"\ndescription: "Imported"\n---\n# Body', { status: 200 });
    }

    return new Response('unexpected', { status: 404 });
  }) as typeof fetch;

  registerEliteRoutes(app, {});

  const response = await invoke(app.handlers, 'GET', '/api/elite/skills/import', {
    query: { url: 'https://github.com/acme/elite-skill' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requestedUrls, [
    'https://api.github.com/repos/acme/elite-skill',
    'https://api.github.com/repos/acme/elite-skill/contents',
    'https://raw.githubusercontent.com/acme/elite-skill/main/SKILL.md',
  ]);
  assert.equal((response.payload as { name: string }).name, 'Elite');
});

test('elite import supports github blob URLs', async () => {
  const app = createMockApp();
  const requestedUrls: string[] = [];

  global.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url === 'https://raw.githubusercontent.com/acme/elite-skill/main/SKILL.md') {
      return new Response('---\nname: "Blob Import"\ndescription: "Imported"\n---\n# Blob', { status: 200 });
    }

    return new Response('unexpected', { status: 404 });
  }) as typeof fetch;

  registerEliteRoutes(app, {});

  const response = await invoke(app.handlers, 'GET', '/api/elite/skills/import', {
    query: { url: 'https://github.com/acme/elite-skill/blob/main/SKILL.md' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requestedUrls, ['https://raw.githubusercontent.com/acme/elite-skill/main/SKILL.md']);
  assert.equal((response.payload as { name: string }).name, 'Blob Import');
});

test('elite repository update keeps SKILL.md content synced with metadata', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elite-repo-'));
  const previousAgencyHome = process.env.AGENCY_HOME;

  try {
    process.env.AGENCY_HOME = tempDir;
    const created = await eliteRepo.createSkill({
      name: 'Elite Sales',
      description: 'Close deals',
      expert: { name: 'Alice', department: 'sales', title: 'Lead' },
      category: 'sales',
      tags: ['sales'],
      content: '# Original body',
      createdBy: 'admin-user',
    });

    await eliteRepo.updateSkill(created.id, {
      description: 'Updated description',
      content: '# Updated body',
      tags: ['sales', 'updated'],
    });

    const updatedFile = await eliteRepo.getSkillFile(created.id);
    assert.ok(updatedFile);
    assert.equal(updatedFile.skill.description, 'Updated description');
    assert.equal(updatedFile.content.includes('# Updated body'), true);
    assert.equal(updatedFile.content.includes('Updated description'), true);
  } finally {
    if (previousAgencyHome === undefined) {
      delete process.env.AGENCY_HOME;
    } else {
      process.env.AGENCY_HOME = previousAgencyHome;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
