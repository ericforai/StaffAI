import path from 'node:path';
import type express from 'express';
import { registerAgencyRoutes } from '../api/agency';
import { registerApprovalRoutes } from '../api/approvals';
import { registerDiscussionRoutes } from '../api/discussions';
import { registerExecutionRoutes } from '../api/executions';
import { registerMemoryRoutes } from '../api/memory';
import { registerRuntimeRoutes } from '../api/runtime';
import { registerStartupRoutes } from '../api/startup';
import { registerTaskEventRoutes } from '../api/task-events';
import { registerTaskRoutes } from '../api/tasks';
import { registerToolRoutes } from '../api/tools';
import { retrieveMemoryContext, writeExecutionSummaryToMemory } from '../memory/memory-retriever';
import {
  createTaskEventPublisher,
  type TaskDashboardEvent,
} from '../observability/task-events';
import type { DashboardEvent } from '../observability/dashboard-events';
import { Scanner } from '../scanner';
import { SkillScanner } from '../skill-scanner';
import { Store } from '../store';
import { DiscussionService } from '../discussion-service';
import type { RuntimePaths } from '../runtime-state';
import { createUserRepository } from '../identity/user-repository.js';
import { createPermissionChecker } from '../identity/permission-checker.js';
import { createUserContextService } from '../identity/user-context.js';
import { createUserContextMiddleware } from '../middleware/user-context.middleware.js';

interface RouteRegistrationDependencies {
  app: express.Application;
  scanner: Scanner;
  skillScanner: SkillScanner;
  store: Store;
  discussionService: DiscussionService;
  runtimePaths: RuntimePaths;
  broadcast: (event: DashboardEvent) => void;
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
}

export function registerBackendRoutes({
  app,
  scanner,
  skillScanner,
  store,
  discussionService,
  runtimePaths,
  broadcast,
  runAdvancedDiscussion,
}: RouteRegistrationDependencies) {
  const samplingEnabled =
    process.env.AGENCY_RUNTIME_SAMPLING === '1' ||
    process.env.AGENCY_RUNTIME_SAMPLING === 'true';
  const memoryRootDir =
    process.env.AGENCY_MEMORY_DIR || path.resolve(process.cwd(), '.ai');
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
    broadcast(eventWithTimestamp);
  });

  // Initialize User Context Service
  const userRepository = createUserRepository();
  const permissionChecker = createPermissionChecker();
  const userContextService = createUserContextService(
    userRepository,
    permissionChecker
  );

  // Register user context middleware (optional, can be enabled via env)
  const authStrategy = (process.env.AGENCY_AUTH_STRATEGY || 'none') as 'header' | 'cookie' | 'jwt' | 'none';
  if (authStrategy !== 'none') {
    app.use('/api', createUserContextMiddleware({
      userContextService,
      authStrategy,
      headerName: process.env.AGENCY_USER_HEADER || 'X-User-Id',
    }));
  }

  registerStartupRoutes(app, {
    discussionService,
  });
  registerTaskEventRoutes(app, { taskEventFeed });

  registerAgencyRoutes(app, {
    scanner,
    skillScanner,
    store,
    broadcast,
    userContextService,
  });

  registerRuntimeRoutes(app, {
    scanner,
    skillScanner,
    store,
    discussionService,
    runtimePaths,
  });

  registerTaskRoutes(app, store, {
    getAgentProfiles: () =>
      scanner
        .getAllAgents()
        .map((agent) => agent.profile)
        .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile)),
    runAdvancedDiscussion: runAdvancedDiscussion
      ? runAdvancedDiscussion
      : async (topic) => discussionService.runDiscussionSummary(topic),
    onTaskCreated: (task) => {
      taskEvents.taskCreated(task);
    },
    onApprovalRequested: async (taskId) => {
      const approvals = await store.getApprovalsByTaskId(taskId);
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
    sessionCapabilities: {
      sampling: samplingEnabled,
    },
  });

  registerApprovalRoutes(app, store, {
    onApprovalResolved: (approval) => {
      taskEvents.approvalResolved(approval);
    },
  });

  registerExecutionRoutes(app, store);
  registerToolRoutes(app, store);
  registerMemoryRoutes(app, { memoryRootDir });

  registerDiscussionRoutes(app, {
    discussionService,
    store,
    broadcast,
  });
}
