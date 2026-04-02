import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Scanner } from '../scanner';
import { Store } from '../store';
import { SkillScanner } from '../skill-scanner';
import { WebServer } from '../server';
import { createServer } from 'node:http';

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

test('GET /api/workshop/proxy-stream should proxy SSE events', async () => {
  // Start a mock workshop SSE server
  const mockWorkshop = createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: {"message": "hello"}\n\n');
    setTimeout(() => {
      res.write('data: {"message": "world"}\n\n');
      res.end();
    }, 100);
  });
  
  const workshopPort = await new Promise<number>((resolve) => {
    mockWorkshop.listen(0, () => resolve((mockWorkshop.address() as any).port));
  });

  // Register the mock workshop
  await fetch(`${baseUrl}/api/workshop/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `http://127.0.0.1:${workshopPort}`, capabilities: ['streaming'] }),
  });

  // Try to connect to the proxy
  // Note: We pass the workshopUrl as a query param for testing purposes
  const response = await fetch(`${baseUrl}/api/workshop/proxy-stream?workshopUrl=http://127.0.0.1:${workshopPort}`);
  
  // This should fail with 404 because the proxy endpoint is not implemented yet
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type')?.includes('text/event-stream'), true);
  
  mockWorkshop.close();
});
