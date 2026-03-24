import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { Scanner } from './scanner';
import { SkillScanner } from './skill-scanner';
import { Store } from './store';
import { DiscussionService } from './discussion-service';
import { DiscussionRuntime } from './runtime/discussion-runtime';
import type { DashboardEvent } from './observability/dashboard-events';
import { createRuntimePaths } from './runtime-state';
import { registerTaskRoutes } from './api/tasks';
import { registerApprovalRoutes } from './api/approvals';
import { registerExecutionRoutes } from './api/executions';
import { registerRuntimeRoutes } from './api/runtime';
import { registerDiscussionRoutes } from './api/discussions';
import { registerAgencyRoutes } from './api/agency';
import { registerStartupRoutes } from './api/startup';
import { registerTaskEventRoutes } from './api/task-events';
import { retrieveMemoryContext, writeExecutionSummaryToMemory } from './memory/memory-retriever';
import { createTaskEventPublisher, type TaskDashboardEvent } from './observability/task-events';

interface WebServerDependencies {
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
}

export class WebServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private scanner: Scanner;
  private skillScanner: SkillScanner;
  private store: Store;
  private discussionService: DiscussionService;
  private runtimePaths = createRuntimePaths();

  constructor(scanner: Scanner, store: Store, skillScanner: SkillScanner, private dependencies: WebServerDependencies = {}) {
    this.app = express();
    this.scanner = scanner;
    this.skillScanner = skillScanner;
    this.store = store;

    this.app.use(cors());
    this.app.use(express.json());
    
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    const discussionRuntime = new DiscussionRuntime({
      workspaceRoot: path.resolve(__dirname, '../../..'),
      claudePath: process.env.AGENCY_DISCUSSION_CLAUDE_PATH || '/Users/user/.nvm/versions/node/v22.16.0/bin/claude',
      codexPath: process.env.AGENCY_DISCUSSION_CODEX_PATH || '/Users/user/.nvm/versions/node/v22.16.0/bin/codex',
    });
    this.discussionService = new DiscussionService(scanner, store, (event) => this.broadcast(event), {
      runtime: discussionRuntime,
    });

    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupRoutes() {
    const memoryRootDir = process.env.AGENCY_MEMORY_DIR || path.resolve(process.cwd(), '.ai');
    const taskEventFeed: Array<TaskDashboardEvent & { timestamp: string }> = [];
    const taskEvents = createTaskEventPublisher((event) => {
      const eventWithTimestamp = {
        ...event,
        timestamp: new Date().toISOString(),
      };
      taskEventFeed.unshift(eventWithTimestamp);
      if (taskEventFeed.length > 200) {
        taskEventFeed.length = 200;
      }
      this.broadcast(eventWithTimestamp);
    });

    registerStartupRoutes(this.app, {
      discussionService: this.discussionService,
    });
    registerTaskEventRoutes(this.app, { taskEventFeed });

    registerAgencyRoutes(this.app, {
      scanner: this.scanner,
      skillScanner: this.skillScanner,
      store: this.store,
      broadcast: (event) => this.broadcast(event),
    });

    registerRuntimeRoutes(this.app, {
      scanner: this.scanner,
      skillScanner: this.skillScanner,
      store: this.store,
      discussionService: this.discussionService,
      runtimePaths: this.runtimePaths,
    });

    registerTaskRoutes(this.app, this.store, {
      runAdvancedDiscussion: this.dependencies.runAdvancedDiscussion
        ? this.dependencies.runAdvancedDiscussion
        : async (topic) => {
            return this.discussionService.runDiscussionSummary(topic);
          },
      onTaskCreated: (task) => {
        taskEvents.taskCreated(task);
      },
      onApprovalRequested: (taskId) => {
        const approvals = this.store.getApprovalsByTaskId(taskId);
        const latestApproval = approvals[approvals.length - 1];
        if (latestApproval) {
          taskEvents.approvalRequested(latestApproval);
        }
      },
      onExecutionStarted: (input) => {
        taskEvents.executionStarted(input);
      },
      onExecutionFinished: (execution) => {
        taskEvents.executionFinished(execution);
      },
      loadMemoryContext: (task) => {
        const retrieved = retrieveMemoryContext(`${task.title}\n${task.description}`, {
          memoryRootDir,
          limit: 2,
        });
        return retrieved.context || undefined;
      },
      writeExecutionSummary: (task, execution) => {
        writeExecutionSummaryToMemory(task, execution, {
          memoryRootDir,
        });
      },
    });
    registerApprovalRoutes(this.app, this.store, {
      onApprovalResolved: (approval) => {
        taskEvents.approvalResolved(approval);
      },
    });
    registerExecutionRoutes(this.app, this.store);

    registerDiscussionRoutes(this.app, {
      discussionService: this.discussionService,
      store: this.store,
      broadcast: (event) => this.broadcast(event),
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('Dashboard connected via WebSocket');
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'The Agency HQ v2.0 Live' }));
    });
  }

  public broadcast(data: DashboardEvent) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public start(port: number) {
    void this.listen(port);
  }

  public listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.off('error', onError);
        reject(error);
      };

      this.server.once('error', onError);
      this.server.listen(port, '127.0.0.1', () => {
        this.server.off('error', onError);
        const address = this.server.address();
        const actualPort =
          typeof address === 'object' && address !== null ? address.port : port;
        console.log(`Agency HQ Web Server running on http://127.0.0.1:${actualPort}`);
        console.log(`Startup check available at http://127.0.0.1:${actualPort}/startup-check`);
        resolve(actualPort);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.clients.forEach((client) => client.terminate());
      this.wss.close((wsError) => {
        if (wsError) {
          reject(wsError);
          return;
        }
        this.server.close((serverError) => {
          if (serverError) {
            reject(serverError);
            return;
          }
          resolve();
        });
      });
    });
  }
}
