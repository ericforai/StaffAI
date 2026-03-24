import type { Agent } from '../types';
import type { DiscussionEventPublisher } from '../observability/discussion-event-publisher';
import type { ExecutorName } from '../runtime/discussion-types';
import type { ExpertCandidate } from './expert-discovery';
import type { DiscussionParticipant } from './discussion-roster';
import { collectDiscussionReplies } from './discussion-collector';
import { runConsultWorkflow } from './consult-workflow';
import { runDiscussionWorkflow } from './discussion-workflow';

export interface AgencyConsultResult {
  task: string;
  expert: ExpertCandidate;
  response: string;
  executor: ExecutorName;
  autoHired: boolean;
}

export interface DiscussionRunResult {
  topic: string;
  participants: DiscussionParticipant[];
  synthesis: string;
  executor: ExecutorName;
  degraded: boolean;
  failedParticipants: DiscussionParticipant[];
}

interface DiscussionWorkflowFacadeDependencies {
  events: DiscussionEventPublisher;
  hireExperts: (agentIds: string[]) => {
    hired: Array<{ id: string; name: string }>;
    alreadyActive: Array<{ id: string; name: string }>;
    missing: string[];
  };
  getAgent: (id: string) => Agent | undefined;
  generateExpertReply: (agent: Agent, assignment: string) => Promise<{ text: string; executor: ExecutorName }>;
  synthesizeDiscussion: (
    topic: string,
    participants: DiscussionParticipant[],
  ) => Promise<{ text: string; executor: ExecutorName }>;
}

export function createDiscussionWorkflowFacade(dependencies: DiscussionWorkflowFacadeDependencies) {
  return {
    async runConsult(task: string, expert: ExpertCandidate, agent: Agent): Promise<AgencyConsultResult> {
      return runConsultWorkflow(
        {
          task,
          expert,
          agent,
        },
        {
          onProgress: (stage) => {
            if (stage === 'matching-expert') {
              dependencies.events.consultMatchingExpert();
              return;
            }

            if (stage === 'hiring-expert') {
              dependencies.events.consultHiringExpert(expert.name);
              return;
            }

            if (stage === 'executing-expert') {
              dependencies.events.consultExecutingExpert(task, expert.id, expert.name);
              return;
            }
          },
          hireExpert: (expertId) => {
            dependencies.hireExperts([expertId]);
          },
          generateReply: async (resolvedAgent, assignment) => {
            const reply = await dependencies.generateExpertReply(resolvedAgent, assignment);
            dependencies.events.consultCompleted(task, expert.id, expert.name, reply.executor);
            return reply;
          },
        },
      );
    },
    async runDiscussion(topic: string, participants: DiscussionParticipant[]): Promise<DiscussionRunResult> {
      return runDiscussionWorkflow({
        topic,
        participants,
        onProgress: (stage) => {
          if (stage === 'preparing-squad') {
            dependencies.events.discussionPreparing(topic);
            return;
          }
          if (stage === 'hiring-experts') {
            dependencies.events.discussionHiringExperts(topic);
            return;
          }
          if (stage === 'assigning-tasks') {
            dependencies.events.discussionAssigningTasks(topic);
            return;
          }
          if (stage === 'synthesizing') {
            dependencies.events.discussionSynthesizing(topic);
            return;
          }
        },
        onDiscussionStarted: (rosterParticipants, hiredAgentIds) => {
          dependencies.events.discussionStarted(topic, rosterParticipants, hiredAgentIds);
        },
        onDiscussionCompleted: (completedParticipants) => {
          dependencies.events.discussionCompleted(
            topic,
            completedParticipants,
            completedParticipants.some((participant) => participant.failed === true),
          );
        },
        hireExperts: (ids) => dependencies.hireExperts(ids),
        collectReplies: async () =>
          collectDiscussionReplies(participants, {
            getAgent: (id) => dependencies.getAgent(id),
            onAssigned: () => undefined,
            onWorking: () => undefined,
            onProgress: (participant, index, total) => {
              dependencies.events.discussionCollectingReply(topic, participant, index, total);
            },
            onCompleted: (participant) => {
              dependencies.events.agentTaskCompleted(topic, participant);
            },
            onFailed: (participant, reason) => {
              dependencies.events.discussionParticipantFailed(topic, participant, reason);
            },
            generateReply: async (agentRecord, assignment) => dependencies.generateExpertReply(agentRecord, assignment),
          }),
        synthesize: async (completedParticipants) => dependencies.synthesizeDiscussion(topic, completedParticipants),
      });
    },
  };
}
