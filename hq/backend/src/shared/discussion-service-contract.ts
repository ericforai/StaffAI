import type { ExpertCandidate } from '../orchestration/expert-discovery';
import type { DiscussionRunResult, AgencyConsultResult } from '../orchestration/discussion-workflow-facade';
import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import type { ExecutorName, StartupCheckResult } from '../runtime/discussion-types';

export interface DiscussionSummaryResult {
  summary: string;
  executor: ExecutorName;
}

export type DiscussionStartupCheckResult = StartupCheckResult;

export interface DiscussionServiceContract {
  searchExperts(topic: string, requestedCount?: number): ExpertCandidate[];
  consultTheAgency(task: string): Promise<AgencyConsultResult>;
  hireExperts(agentIds: string[]): {
    hired: Array<{ id: string; name: string }>;
    alreadyActive: Array<{ id: string; name: string }>;
    missing: string[];
  };
  prepareDiscussion(topic: string, requestedCount?: number, agentIds?: string[]): DiscussionParticipant[];
  runDiscussion(topic: string, requestedCount?: number, agentIds?: string[]): Promise<DiscussionRunResult>;
  runDiscussionSummary(topic: string): Promise<DiscussionSummaryResult>;
  getStartupCheck(): Promise<DiscussionStartupCheckResult>;
}
