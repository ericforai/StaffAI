import path from 'node:path';
import type express from 'express';
import { registerAgencyRoutes } from '../api/agency';
import { registerApprovalRoutes } from '../api/approvals';
import { registerApprovalChainRoutes } from '../api/approval-chains';
import { registerDiscussionRoutes } from '../api/discussions';
import { registerMarketRoutes } from '../api/market';
import { registerExecutionRoutes } from '../api/executions';
import { registerMemoryRoutes } from '../api/memory';
import { registerRuntimeRoutes } from '../api/runtime';
import { registerStartupRoutes } from '../api/startup';
import { registerTaskEventRoutes } from '../api/task-events';
import { registerTaskRoutes, registerScenarioRoutes } from '../api/tasks';
import { registerToolRoutes } from '../api/tools';
import { registerTemplateRoutes } from '../api/templates';
import { registerAuditRoutes } from '../api/audit';
import { registerPresetRoutes } from '../api/presets';
import { registerSquadTemplateRoutes } from '../api/squad-templates';
import { registerIntentRoutes } from '../api/intents';
import { registerCrmRoutes } from '../api/crm';
import { registerWorkshopRoutes } from '../api/workshop';
import { createWriteBackService } from '../memory/write-back-service';
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
import { BudgetService } from '../governance/budget-service';
import { createSquadTemplateService } from '../orchestration/squad-template-service';
import { createMemoryLayerService } from '../orchestration/memory-layer-service';
import { createWorkflowExecutionEngine } from '../orchestration/workflow-execution-engine';
import { createAssignmentExecutor } from '../orchestration/assignment-executor';
import type { TaskRecord, ExecutionRecord } from '../shared/task-types';
import { HitlService } from '../orchestration/hitl-service';
import { TaskStateMachine } from '../orchestration/task-state-machine';
import { TaskRepositoryAdapter } from '../shared/task-repository-adapter';
import { getPersistenceMode } from '../store';
import {
  createFileContactRepository,
  createFileCompanyRepository,
  createFileDealRepository,
  createFileActivityRepository,
  createInMemoryContactRepository,
  createInMemoryCompanyRepository,
  createInMemoryDealRepository,
  createInMemoryActivityRepository,
} from '../persistence/crm-repositories';
import {
  createContactService,
  createCompanyService,
  createDealService,
  createActivityService,
  createDashboardService,
} from '../crm/crm-service';

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

  // Initialize assignment executor
  const assignmentExecutor = createAssignmentExecutor({
    store,
    auditLogger: null,
    executor: (process.env.AGENCY_RUNTIME_DEFAULT_EXECUTOR as any) || 'claude',
  });

  // Initialize workflow execution engine
  const workflowExecutionEngine = createWorkflowExecutionEngine({
    store,
    assignmentExecutor,
    auditLogger: null,
    scanner,
  });

  // Initialize HITL Service
  const taskStateMachine = new TaskStateMachine(new TaskRepositoryAdapter(store));
  const hitlService = new HitlService({ store, stateMachine: taskStateMachine });
  app.set('hitlService', hitlService);

  // Initialize Lifecycle Service
  const lifecycleService = createTaskLifecycleService({
    store,
    auditLogger: store.getAuditLogger() || undefined,
  });
  app.locals.lifecycleService = lifecycleService;

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

  // Register user context middleware
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
  registerWorkshopRoutes(app);
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

  // Shared execution base properties to avoid duplication
  const executionBase = {
    onExecutionStarted: (input: any) => {
      taskEvents.executionStarted(input);
    },
    onExecutionFinished: (execution: any) => {
      taskEvents.executionFinished(execution);
    },
    onExecutionEvent: (input: any) => {
      taskEvents.executionEvent(input);
    },
    loadMemoryContext: (task: TaskRecord) => {
      const result = memoryLayerService.loadMemory(task);
      return result.context || undefined;
    },
    writeExecutionSummary: (task: TaskRecord, execution: ExecutionRecord) => {
      memoryLayerService.writeback(task, execution);
    },
    sessionCapabilities: {
      sampling: samplingEnabled,
    },
    runAdvancedDiscussion: runAdvancedDiscussion
      ? runAdvancedDiscussion
      : async (topic: any) => discussionService.runDiscussionSummary(topic),
  };

  // Register task routes
  registerTaskRoutes(app, store, {
    ...executionBase,
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
  });

  registerApprovalRoutes(app, store, {
    ...executionBase,
    onApprovalResolved: (approval) => {
      taskEvents.approvalResolved(approval);
    },
    autoExecuteAfterApproval: true,
  });

  registerExecutionRoutes(app, store, { workflowExecutionEngine });
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

  // Initialize BudgetService (Singleton)
  const budgetService = BudgetService.getInstance();

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
  registerApprovalChainRoutes(app, store);

  // Register intent routes (HITL)
  registerIntentRoutes(app, store);

  // ─── CRM Routes ─────────────────────────────────────────────────────────────
  const persistenceMode = getPersistenceMode();

  // Contact repository
  const crmContactsFile = process.env.AGENCY_CRM_CONTACTS_FILE || path.join(memoryRootDir, 'crm_contacts.json');
  const contactRepo =
    persistenceMode === 'memory'
      ? createInMemoryContactRepository()
      : createFileContactRepository(crmContactsFile);

  // Company repository
  const crmCompaniesFile = process.env.AGENCY_CRM_COMPANIES_FILE || path.join(memoryRootDir, 'crm_companies.json');
  const companyRepo =
    persistenceMode === 'memory'
      ? createInMemoryCompanyRepository()
      : createFileCompanyRepository(crmCompaniesFile);

  // Deal repository
  const crmDealsFile = process.env.AGENCY_CRM_DEALS_FILE || path.join(memoryRootDir, 'crm_deals.json');
  const dealRepo =
    persistenceMode === 'memory'
      ? createInMemoryDealRepository()
      : createFileDealRepository(crmDealsFile);

  // Activity repository
  const crmActivitiesFile = process.env.AGENCY_CRM_ACTIVITIES_FILE || path.join(memoryRootDir, 'crm_activities.json');
  const activityRepo =
    persistenceMode === 'memory'
      ? createInMemoryActivityRepository()
      : createFileActivityRepository(crmActivitiesFile);

  // CRM services
  const contactService = createContactService(contactRepo, companyRepo);
  const companyService = createCompanyService(companyRepo);
  const dealService = createDealService(dealRepo, contactRepo, companyRepo);
  const activityService = createActivityService(activityRepo);
  const dashboardService = createDashboardService(contactRepo, companyRepo, dealRepo, activityRepo);

  registerCrmRoutes(app, { contactService, companyService, dealService, activityService, dashboardService });
}

function registerBudgetRoutes(app: express.Application, deps: { budgetService: BudgetService }) {
}

export { getPersistenceMode };
