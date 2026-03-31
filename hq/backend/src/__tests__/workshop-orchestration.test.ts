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

test('POST /api/tasks/:id/execute with deerflow executor should route to workshop', async () => {
  // 1. Start mock workshop
  let receivedTask = false;
  const mockWorkshop = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      receivedTask = true;
      res.writeHead(200, { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      // Send SSE events that the adapter expects
      res.write('event: message\n');
      res.write('data: {"content": "Mock workshop result"}\n\n');
      setTimeout(() => {
        res.end();
      }, 100);
    });
  });
  
  const workshopPort = await new Promise<number>((resolve) => {
    mockWorkshop.listen(0, () => resolve((mockWorkshop.address() as any).port));
  });

  const workshopUrl = `http://127.0.0.1:${workshopPort}`;

  // 2. Register workshop
  await fetch(`${baseUrl}/api/workshop/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      url: workshopUrl, 
      capabilities: ['deer-flow'] 
    }),
  });

  // 3. Create a task
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Test Workshop Task',
      description: 'Test orchestration',
      priority: 'medium'
    }),
  });
  const createPayload = (await createRes.json()) as any;
  const task = createPayload.task;

  // 4. Execute task with deerflow
  console.log('Executing task with ID:', task.id);
  const executeRes = await fetch(`${baseUrl}/api/tasks/${task.id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor: 'deerflow',
      summary: 'Executing via workshop'
    }),
  });

  console.log('Execute status:', executeRes.status);
  const body = (await executeRes.json()) as any;
  console.log('Execution result:', JSON.stringify(body));
  
  assert.equal(receivedTask, true, "Mock workshop should have received the task");
  assert.equal(body.execution.status, 'completed');
  assert.equal(body.execution.outputSummary, 'Mock workshop result');

  // 5. Verify persistence
  const getTaskRes = await fetch(`${baseUrl}/api/tasks/${task.id}`);
  const getTaskPayload = (await getTaskRes.json()) as any;
  assert.equal(getTaskPayload.task.status, 'completed');
  // Note: outputSummary is usually on the execution object, but some task types might bubble it up
  
  mockWorkshop.close();
});
