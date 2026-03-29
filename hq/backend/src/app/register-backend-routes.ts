import path from 'node:path';
import type express from 'express';
import { registerAgencyRoutes } from '../api/agency';
import { registerApprovalRoutes } from '../api/approvals';
import { registerApprovalChainRoutes } from '../api/approval-chains';
import { registerBudgetRoutes } from '../api/budget';
import { registerDiscussionRoutes } from '../api/discussions';
import { registerMarketRoutes } from '../api/market';
import { registerExecutionRoutes } from '../api/executions';
import { registerMemoryRoutes } from '../api/memory';
import { registerRuntimeRoutes } from '../api/runtime';
import { registerStartupRoutes } from '../api/startup';
import { registerSquadTemplateRoutes } from '../api/squad-templates';
import { registerTaskEventRoutes } from '../api/task-events';
import { registerTaskRoutes, registerScenarioRoutes } from '../api/tasks';
import { registerToolRoutes } from '../api/tools';
import { registerTemplateRoutes } from '../api/templates';
import { registerAuditRoutes } from '../api/audit';
import { registerPresetRoutes } from '../api/presets';
import { retrieveMemoryContext } from '../memory/memory-retriever';
import { createWriteBackService } from '../memory/write-back-service';
import { BudgetService } from '../governance/budget-service';
import { createMemoryLayerService } from '../orchestration/memory-layer-service';
import { createSquadTemplateService } from '../orchestration/squad-template-service';
import {
  createTaskEventPublisher,
  type TaskDashboardEvent,
} from '../observability/task-events';
import type { DashboardEvent } from '../observability/dashboard-events';
import { Scanner } from '../scanner';
import { SkillScanner } from '../skill-scanner';
import { Store } from '../store';
import type { DiscussionServiceContract } from '../shared/discussion-service-contract';
import type { RuntimePaths } from '../runtime/runtime-state';
import { createUserRepository } from '../identity/user-repository';
import { createPermissionChecker } from '../identity/permission-checker';
import { createUserContextService } from '../identity/user-context';
import { createUserContextMiddleware } from '../middleware/user-context.middleware';

interface RouteRegistrationDependencies {
  app: express.Application;
  scanner: Scanner;
  skillScanner: SkillScanner;
  store: Store;
  discussionService: DiscussionServiceContract;
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

  // Initialize enhanced write-back service
  const writeBackService = createWriteBackService({
    memoryRootDir,
    enableSuccessFailureCategorization: true,
    enableDecisionRecords: true,
    retainLegacyTaskSummaries: true,
    markdownTemplateFormat: 'frontmatter',
  });

  // Initialize memory layer service (L1/L2/L3 hierarchy)
  const memoryLayerService = createMemoryLayerService({
    memoryRootDir,
  });

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
    onExecutionEvent: (input) => {
      taskEvents.executionEvent(input);
    },
    loadMemoryContext: async (task) => {
      const result = await memoryLayerService.loadMemory(task);
      return result.context || undefined;
    },
    writeExecutionSummary: async (task, execution) => {
      await memoryLayerService.writeback(task, execution);
    },
    sessionCapabilities: {
      sampling: samplingEnabled,
    },
  });

  registerApprovalRoutes(app, store, {
    onApprovalResolved: (approval) => {
      taskEvents.approvalResolved(approval);
    },
    onExecutionStarted: (input) => {
      taskEvents.executionStarted(input);
    },
    onExecutionFinished: (execution) => {
      taskEvents.executionFinished(execution);
    },
    onExecutionEvent: (input) => {
      taskEvents.executionEvent(input);
    },
    loadMemoryContext: async (task) => {
      const result = await memoryLayerService.loadMemory(task);
      return result.context || undefined;
    },
    writeExecutionSummary: async (task, execution) => {
      await memoryLayerService.writeback(task, execution);
    },
    sessionCapabilities: {
      sampling: samplingEnabled,
    },
    runAdvancedDiscussion: runAdvancedDiscussion
      ? runAdvancedDiscussion
      : async (topic) => discussionService.runDiscussionSummary(topic),
    autoExecuteAfterApproval: true,
  });

  registerExecutionRoutes(app, store);
  registerToolRoutes(app, store);
  registerMemoryRoutes(app, { memoryRootDir });

  // Register audit routes if audit logger is enabled
  const auditLogger = store.getAuditLogger();
  if (auditLogger) {
    registerAuditRoutes(app, auditLogger, store);
  }

  // Register MVP preset routes
  registerPresetRoutes(app, store, scanner);

  // Register MVP scenario routes
  registerScenarioRoutes(app, store, scanner);

  // Register template routes
  registerTemplateRoutes(app, { store });

  registerDiscussionRoutes(app, {
    discussionService,
    store,
    broadcast,
  });

  // Register talent market routes
  registerMarketRoutes(app, { store });

  // Initialize BudgetService
  const budgetService = new BudgetService();

  // Register budget routes
  registerBudgetRoutes(app, { budgetService });

  // Initialize SquadTemplateService
  const squadTemplateService = createSquadTemplateService({
    getAgent: (id: string) => scanner.getAgent(id),
  });

  // Register squad template routes
  registerSquadTemplateRoutes(app, {
    squadTemplateService,
    getAgent: (id: string) => scanner.getAgent(id),
  });

  // Register approval chain routes
  registerApprovalChainRoutes(app);
}
