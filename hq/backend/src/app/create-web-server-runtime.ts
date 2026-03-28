import cors from 'cors';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { Scanner } from '../scanner';
import { SkillScanner } from '../skill-scanner';
import { Store } from '../store';
import { createDiscussionService } from './create-discussion-service';
import { registerBackendRoutes } from './register-backend-routes';
import { ToolGateway } from '../tools/tool-gateway';
import { McpGateway } from '../mcp';
import type { DashboardEvent } from '../observability/dashboard-events';
import { createRuntimePaths } from '../runtime/runtime-state';
import { initializeMemoryLayout, getMemoryDirectory } from '../memory/memory-initializer';

interface WebServerRuntimeDependencies {
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
}

interface WebServerRuntimeInput {
  scanner: Scanner;
  store: Store;
  skillScanner: SkillScanner;
  dependencies?: WebServerRuntimeDependencies;
}

export interface WebServerRuntime {
  broadcast: (data: DashboardEvent) => void;
  listen: (port: number) => Promise<number>;
  stop: () => Promise<void>;
  mcp: McpGateway;
}

function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    const allowed = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:8888', 'http://127.0.0.1:8888'];
    if (origin && !allowed.includes(origin)) {
      ws.close(1008, 'Origin not allowed');
      return;
    }
    console.log('Dashboard connected via WebSocket');
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'The Agency HQ v2.0 Live' }));
  });

  return wss;
}

function broadcastToClients(wss: WebSocketServer, data: DashboardEvent) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function registerRoutes(
  app: express.Application,
  scanner: Scanner,
  skillScanner: SkillScanner,
  store: Store,
  broadcast: (event: DashboardEvent) => void,
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>,
) {
  const runtimePaths = createRuntimePaths();
  const discussionService = createDiscussionService(
    scanner,
    skillScanner,
    store,
    (event) => broadcast(event),
  );

  registerBackendRoutes({
    app,
    scanner,
    skillScanner,
    store,
    discussionService,
    runtimePaths,
    broadcast: (event) => broadcast(event),
    runAdvancedDiscussion,
  });

  return { runtimePaths, discussionService };
}

export function createWebServerRuntime({
  scanner,
  store,
  skillScanner,
  dependencies = {},
}: WebServerRuntimeInput): WebServerRuntime {
  const app = express();
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:8888', 'http://127.0.0.1:8888', 'http://localhost:3008', 'http://127.0.0.1:3008'];
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  const server = http.createServer(app);
  const wss = setupWebSocket(server);
  const broadcast = (event: DashboardEvent) => broadcastToClients(wss, event);

  // Initialize tool gateway and MCP gateway
  const toolGateway = new ToolGateway(store);
  const mcp = new McpGateway(scanner, store, toolGateway);

  // Register MCP SSE routes
  app.get('/api/mcp/sse', (req, res) => {
    void mcp.handleSse(req, res);
  });

  app.post('/api/mcp/message', (req, res) => {
    void mcp.handlePostMessage(req, res);
  });

  // Initialize .ai/ memory directory structure
  const memoryRootDir = getMemoryDirectory();
  initializeMemoryLayout(memoryRootDir)
    .then((layout) => {
      console.log(`[Memory] Initialized .ai/ directory structure at ${layout.memoryRootDir}`);
    })
    .catch((error: Error) => {
      console.error(`[Memory] Failed to initialize .ai/ directory structure:`, error.message);
    });

  registerRoutes(app, scanner, skillScanner, store, broadcast, dependencies.runAdvancedDiscussion);

  return {
    broadcast,
    mcp,
    listen(port: number) {
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('error', onError);
          reject(error);
        };

        server.once('error', onError);
        server.listen(port, '0.0.0.0', () => {
          server.off('error', onError);
          const address = server.address();
          const actualPort =
            typeof address === 'object' && address !== null ? address.port : port;
          console.log(`Agency HQ Web Server running on http://0.0.0.0:${actualPort}`);
          console.log(`Startup check available at http://127.0.0.1:${actualPort}/startup-check`);
          resolve(actualPort);
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        wss.clients.forEach((client) => client.terminate());
        wss.close((wsError) => {
          if (wsError) {
            reject(wsError);
            return;
          }
          server.close((serverError) => {
            if (serverError) {
              reject(serverError);
              return;
            }
            resolve();
          });
        });
      });
    },
  };
}
