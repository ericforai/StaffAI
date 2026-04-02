import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Scanner } from '../scanner';
import { Store } from '../store';
import { SkillScanner } from '../skill-scanner';
import { WebServer } from '../server';

import { WorkshopRegistrationResponse } from '../shared/workshop-types';

let webServer: WebServer;
let baseUrl = '';

before(async () => {
  const scanner = new Scanner();
  const store = new Store();
  const skillScanner = new SkillScanner();

  webServer = new WebServer(scanner, store, skillScanner);
  const port = await webServer.listen(0);
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (webServer) {
    await webServer.stop();
  }
});

test('POST /api/workshop/register registers a workshop instance', async () => {
  const payload = {
    url: 'http://localhost:8000',
    capabilities: ['deer-flow', 'langgraph'],
  };

  const response = await fetch(`${baseUrl}/api/workshop/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as WorkshopRegistrationResponse;
  assert.equal(data.status, 'success');
  assert.equal(data.workshop?.url, 'http://localhost:8000');
});

test('GET /api/workshop/list returns registered workshops', async () => {
  const response = await fetch(`${baseUrl}/api/workshop/list`);
  assert.equal(response.status, 200);
  const data = (await response.json()) as any;
  assert.equal(Array.isArray(data.workshops), true);
});
