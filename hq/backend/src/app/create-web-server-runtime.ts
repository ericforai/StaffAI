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
}

function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
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
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const wss = setupWebSocket(server);
  const broadcast = (event: DashboardEvent) => broadcastToClients(wss, event);

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
    listen(port: number) {
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
          server.off('error', onError);
          reject(error);
        };

        server.once('error', onError);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', onError);
          const address = server.address();
          const actualPort =
            typeof address === 'object' && address !== null ? address.port : port;
          console.log(`Agency HQ Web Server running on http://127.0.0.1:${actualPort}`);
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
