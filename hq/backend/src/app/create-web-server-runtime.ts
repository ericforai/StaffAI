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
    // 开发环境下放开所有本地源的校验，确保实时追踪流稳定
    console.log(`[WS] Dashboard attempt connection from origin: ${req.headers.origin}`);
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
    : [
        'http://localhost:8888',
        'http://127.0.0.1:8888',
        'http://localhost:3008',
        'http://127.0.0.1:3008',
        'http://localhost:3010',
        'http://127.0.0.1:3010',
      ];

  /** 允许通过局域网 IP 打开前端（如 Next 的 Network URL）；生产环境默认关闭，可用 CORS_ORIGINS 或 AGENCY_DEV_LAN_CORS=1。 */
  const allowLanOrigins =
    process.env.NODE_ENV !== 'production' || process.env.AGENCY_DEV_LAN_CORS === '1';

  function isPrivateLanHostname(hostname: string): boolean {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
      hostname,
    );
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        if (allowLanOrigins) {
          try {
            const u = new URL(origin);
            if ((u.protocol === 'http:' || u.protocol === 'https:') && isPrivateLanHostname(u.hostname)) {
              callback(null, true);
              return;
            }
          } catch {
            /* ignore */
          }
        }
        callback(null, false);
      },
    }),
  );
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
