import type { Agent } from '../types';
import type { DiscussionParticipant } from './discussion-roster';
import type { ExecutorName } from '../runtime/discussion-types';

const MAX_CONCURRENT_REPLIES = 2;

interface DiscussionCollectorDependencies {
  getAgent: (id: string) => Agent | undefined;
  onAssigned: (participant: DiscussionParticipant) => void;
  onWorking: (participant: DiscussionParticipant) => void;
  onProgress: (participant: DiscussionParticipant, index: number, total: number) => void;
  onCompleted: (participant: DiscussionParticipant) => void;
  onFailed: (participant: DiscussionParticipant, reason: string) => void;
  generateReply: (agent: Agent, assignment: string) => Promise<{ text: string; executor: ExecutorName }>;
}

export interface DiscussionReplyCollectionResult {
  participants: DiscussionParticipant[];
  failedParticipants: DiscussionParticipant[];
  executorUsed: ExecutorName | null;
  degraded: boolean;
}

function markFailedParticipant(participant: DiscussionParticipant, reason: string): DiscussionParticipant {
  return {
    ...participant,
    failed: true,
    failureReason: reason,
    response: undefined,
  };
}

async function collectParticipantReply(
  participant: DiscussionParticipant,
  index: number,
  total: number,
  dependencies: DiscussionCollectorDependencies,
): Promise<{ participant: DiscussionParticipant; failedParticipant?: DiscussionParticipant; executor?: ExecutorName }> {
  dependencies.onAssigned(participant);
  dependencies.onWorking(participant);
  dependencies.onProgress(participant, index, total);

  const agent = dependencies.getAgent(participant.id);
  if (!agent) {
    const reason = '未找到专家档案。';
    const failedParticipant = markFailedParticipant(participant, reason);
    dependencies.onFailed(participant, reason);
    return { participant: failedParticipant, failedParticipant };
  }

  try {
    const response = await dependencies.generateReply(agent, participant.assignment);
    const completedParticipant: DiscussionParticipant = {
      ...participant,
      response: response.text,
      failed: false,
      failureReason: undefined,
    };
    dependencies.onCompleted(participant);
    return { participant: completedParticipant, executor: response.executor };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const failedParticipant = markFailedParticipant(participant, reason);
    dependencies.onFailed(participant, reason);
    return { participant: failedParticipant, failedParticipant };
  }
}

export async function collectDiscussionReplies(
  participants: DiscussionParticipant[],
  dependencies: DiscussionCollectorDependencies,
): Promise<DiscussionReplyCollectionResult> {
  const orderedParticipants: DiscussionParticipant[] = new Array(participants.length);
  const failedParticipants: Array<DiscussionParticipant | undefined> = new Array(participants.length);
  let executorUsed: ExecutorName | null = null;

  for (let batchStart = 0; batchStart < participants.length; batchStart += MAX_CONCURRENT_REPLIES) {
    const batch = participants.slice(batchStart, batchStart + MAX_CONCURRENT_REPLIES);
    await Promise.all(
      batch.map(async (participant, offset) => {
        const index = batchStart + offset;
        const result = await collectParticipantReply(participant, index, participants.length, dependencies);
        orderedParticipants[index] = result.participant;
        if (result.failedParticipant) {
          failedParticipants[index] = result.failedParticipant;
        }
        if (result.executor && executorUsed === null) {
          executorUsed = result.executor;
        }
      }),
    );
  }

  return {
    participants: orderedParticipants,
    failedParticipants: failedParticipants.filter((participant): participant is DiscussionParticipant => Boolean(participant)),
    executorUsed,
    degraded: failedParticipants.some((participant) => Boolean(participant)),
  };
}
