import { Scanner } from './scanner';
import { Store } from './store';
import { selectBestExpert } from './orchestration/agency-consult';
import { createExpertDiscoveryService, ExpertCandidate } from './orchestration/expert-discovery';
import {
  createDiscussionWorkflowFacade,
  AgencyConsultResult,
  DiscussionRunResult,
} from './orchestration/discussion-workflow-facade';
import { createDiscussionRosterService, DiscussionParticipant } from './orchestration/discussion-roster';
import { createStaffingService } from './orchestration/staffing-service';
import { createDiscussionExecutionFacade } from './runtime/discussion-execution-facade';
import { createDiscussionEventPublisher, DiscussionEventPublisher } from './observability/discussion-event-publisher';
import type { DashboardEvent } from './observability/dashboard-events';
import type { ExecutorName, StartupCheckResult as RuntimeStartupCheckResult } from './runtime/discussion-types';

export interface DiscussionSummaryResult {
  summary: string;
  executor: ExecutorName;
}

export type StartupCheckResult = RuntimeStartupCheckResult;

type EventPublisher = (event: DashboardEvent) => void;
export type { ExecutorName } from './runtime/discussion-types';

interface DiscussionServiceOptions {
  runtime: {
    getStartupCheck: () => Promise<RuntimeStartupCheckResult>;
    generateText: (systemPrompt: string, userPrompt: string) => Promise<{ text: string; executor: ExecutorName }>;
  };
  workflowFacade?: ReturnType<typeof createDiscussionWorkflowFacade>;
}

export class DiscussionService {
  private scanner: Scanner;
  private store: Store;
  private runtime: DiscussionServiceOptions['runtime'];
  private events: DiscussionEventPublisher;
  private workflowFacade: ReturnType<typeof createDiscussionWorkflowFacade>;

  constructor(scanner: Scanner, store: Store, publish: EventPublisher, options: DiscussionServiceOptions) {
    this.scanner = scanner;
    this.store = store;
    this.runtime = options.runtime;
    const events = createDiscussionEventPublisher(publish);
    this.events = events;
    const executionFacade = createDiscussionExecutionFacade({
      runtime: this.runtime,
      searchKnowledge: (task) => this.store.searchKnowledge(task),
      getAgent: (id) => this.scanner.getAgent(id),
    });
    this.workflowFacade =
      options.workflowFacade ??
      createDiscussionWorkflowFacade({
        events,
        hireExperts: (ids) => this.hireExperts(ids),
        getAgent: (id) => this.scanner.getAgent(id),
        generateExpertReply: async (agent, assignment) => executionFacade.generateExpertReply(agent, assignment),
        synthesizeDiscussion: async (topic, participants) => executionFacade.synthesizeDiscussion(topic, participants),
      });
  }

  public searchExperts(topic: string, requestedCount: number = 4): ExpertCandidate[] {
    return createExpertDiscoveryService({
      getAllAgents: () => this.scanner.getAllAgents(),
      getActiveIds: () => this.store.getActiveIds(),
    }).searchExperts(topic, requestedCount);
  }

  public async consultTheAgency(task: string): Promise<AgencyConsultResult> {
    const bestMatch = selectBestExpert(this.searchExperts(task, 1));
    if (!bestMatch) {
      throw new Error('公司目前没有可用专家。');
    }

    const agent = this.scanner.getAgent(bestMatch.id);
    if (!agent) {
      throw new Error(`未找到专家档案：${bestMatch.id}`);
    }

    return this.workflowFacade.runConsult(task, bestMatch, agent);
  }

  public hireExperts(agentIds: string[]) {
    const result = createStaffingService({
      getAgent: (id) => this.scanner.getAgent(id),
      getActiveIds: () => this.store.getActiveIds(),
      saveActiveIds: (ids) => this.store.save(ids),
    }).hireExperts(agentIds);

    for (const expert of result.hired) {
      this.events.agentHired(expert.id, expert.name);
    }

    return result;
  }

  public prepareDiscussion(topic: string, requestedCount: number = 3, agentIds?: string[]): DiscussionParticipant[] {
    return createDiscussionRosterService({
      searchExperts: (searchTopic, count) => this.searchExperts(searchTopic, count),
      getAgent: (id) => this.scanner.getAgent(id),
    }).prepareDiscussion(topic, requestedCount, agentIds);
  }

  public async runDiscussion(
    topic: string,
    requestedCount: number = 3,
    agentIds?: string[]
  ): Promise<DiscussionRunResult> {
    const participants = this.prepareDiscussion(topic, requestedCount, agentIds);
    return this.workflowFacade.runDiscussion(topic, participants);
  }

  public async runDiscussionSummary(topic: string): Promise<DiscussionSummaryResult> {
    const result = await this.runDiscussion(topic);
    return {
      summary: result.synthesis,
      executor: result.executor,
    };
  }

  public async getStartupCheck(): Promise<StartupCheckResult> {
    return this.runtime.getStartupCheck();
  }
}
