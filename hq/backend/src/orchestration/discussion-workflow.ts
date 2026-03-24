import type { DiscussionParticipant } from './discussion-roster';
import type { ExecutorName } from '../runtime/discussion-types';
import type { DiscussionReplyCollectionResult } from './discussion-collector';

export interface DiscussionWorkflowResult {
  topic: string;
  participants: DiscussionParticipant[];
  synthesis: string;
  executor: ExecutorName;
  degraded: boolean;
  failedParticipants: DiscussionParticipant[];
}

interface DiscussionWorkflowDependencies {
  topic: string;
  participants: DiscussionParticipant[];
  onProgress: (stage: string) => void;
  onDiscussionStarted: (participants: DiscussionParticipant[], hiredAgentIds: string[]) => void;
  onDiscussionCompleted: (participants: DiscussionParticipant[]) => void;
  hireExperts: (agentIds: string[]) => {
    hired: Array<{ id: string; name: string }>;
    alreadyActive: Array<{ id: string; name: string }>;
    missing: string[];
  };
  collectReplies: () => Promise<{
    participants: DiscussionReplyCollectionResult['participants'];
    failedParticipants: DiscussionReplyCollectionResult['failedParticipants'];
    executorUsed: ExecutorName | null;
    degraded: boolean;
  }>;
  synthesize: (participants: DiscussionParticipant[]) => Promise<{ text: string; executor: ExecutorName }>;
}

export async function runDiscussionWorkflow(
  dependencies: DiscussionWorkflowDependencies,
): Promise<DiscussionWorkflowResult> {
  dependencies.onProgress('preparing-squad');

  if (dependencies.participants.length < 2) {
    throw new Error('没有足够的专家来组织讨论。');
  }

  let hiredAgentIds: string[] = [];
  if (dependencies.participants.some((participant) => participant.hiredForTask)) {
    dependencies.onProgress('hiring-experts');
    const hireResult = dependencies.hireExperts(
      dependencies.participants.filter((participant) => participant.hiredForTask).map((participant) => participant.id),
    );
    hiredAgentIds = hireResult.hired.map((participant) => participant.id);
  }

  dependencies.onDiscussionStarted(dependencies.participants, hiredAgentIds);
  dependencies.onProgress('assigning-tasks');

  const collected = await dependencies.collectReplies();
  const successfulParticipants = collected.participants.filter((participant) => !participant.failed);
  if (successfulParticipants.length === 0) {
    throw new Error('没有任何专家回复可用于综合。');
  }

  dependencies.onProgress('synthesizing');
  const synthesis = await dependencies.synthesize(successfulParticipants);
  const executorUsed = collected.executorUsed ?? synthesis.executor;

  dependencies.onProgress('completed');
  dependencies.onDiscussionCompleted(collected.participants);

  return {
    topic: dependencies.topic,
    participants: collected.participants,
    synthesis: synthesis.text,
    executor: executorUsed,
    degraded: collected.degraded,
    failedParticipants: collected.failedParticipants,
  };
}
