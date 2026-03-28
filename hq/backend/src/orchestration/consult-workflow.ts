import { buildConsultAssignment } from './agency-consult';
import type { ExpertCandidate } from './expert-discovery';
import type { Agent } from '../types';

interface ConsultWorkflowInput {
  task: string;
  expert: ExpertCandidate;
  agent: Agent;
}

interface ConsultWorkflowDependencies {
  onProgress: (stage: 'matching-expert' | 'hiring-expert' | 'executing-expert' | 'completed') => void;
  hireExpert: (expertId: string) => void;
  generateReply: (agent: Agent, assignment: string) => Promise<{ text: string; executor: 'claude' | 'codex' | 'openai' | 'deerflow' }>;
}

export async function runConsultWorkflow(input: ConsultWorkflowInput, dependencies: ConsultWorkflowDependencies) {
  dependencies.onProgress('matching-expert');

  if (!input.expert.isActive) {
    dependencies.onProgress('hiring-expert');
    dependencies.hireExpert(input.expert.id);
  }

  const assignment = buildConsultAssignment({
    task: input.task,
    expertName: input.expert.name,
    expertDescription: input.expert.description,
  });

  dependencies.onProgress('executing-expert');
  const reply = await dependencies.generateReply(input.agent, assignment);
  dependencies.onProgress('completed');

  return {
    task: input.task,
    expert: { ...input.expert, isActive: true },
    response: reply.text,
    executor: reply.executor,
    autoHired: !input.expert.isActive,
  };
}
