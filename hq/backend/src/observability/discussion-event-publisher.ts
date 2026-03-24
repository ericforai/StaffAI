import type { DiscussionParticipant } from '../orchestration/discussion-roster';
import type { ExecutorName } from '../runtime/discussion-types';
import type { DashboardEvent } from './dashboard-events';

type EventPublisher = (event: DashboardEvent) => void;

export interface DiscussionEventPublisher {
  toolProgress(
    tool: 'consult_the_agency' | 'expert_discussion',
    stage: string,
    status: 'started' | 'running' | 'completed' | 'failed',
    progress: number,
    message: string,
    executor?: ExecutorName,
  ): void;
  consultMatchingExpert(): void;
  consultHiringExpert(expertName: string): void;
  consultExecutingExpert(task: string, agentId: string, agentName: string): void;
  consultCompleted(
    taskOrExpertName: string,
    agentIdOrExecutor?: string | ExecutorName,
    expertName?: string,
    executor?: ExecutorName,
  ): void;
  discussionPreparing(topic: string): void;
  discussionHiringExperts(topic: string): void;
  discussionAssigningTasks(topic: string): void;
  discussionCollectingReply(topic: string, participant: DiscussionParticipant, index: number, total: number): void;
  discussionParticipantFailed(topic: string, participant: DiscussionParticipant, reason: string): void;
  discussionSynthesizing(topic: string): void;
  discussionStarted(topic: string, participants: DiscussionParticipant[], hiredAgentIds: string[]): void;
  discussionCompleted(topic: string, participants: DiscussionParticipant[], degraded?: boolean): void;
  agentAssigned(topic: string, participant: DiscussionParticipant): void;
  agentWorking(topic: string, participant: DiscussionParticipant): void;
  agentTaskCompleted(task: string, participant: DiscussionParticipant): void;
  agentTaskFailed(task: string, participant: DiscussionParticipant, reason: string): void;
  agentHired(agentId: string, agentName: string): void;
}

function publishProgress(
  publish: EventPublisher,
  tool: 'consult_the_agency' | 'expert_discussion',
  stage: string,
  status: 'started' | 'running' | 'completed' | 'failed',
  progress: number,
  message: string,
  executor?: ExecutorName,
) {
  publish({
    type: 'TOOL_PROGRESS',
    tool,
    stage,
    status,
    progress,
    message,
    executor,
  });
}

function getReplyProgress(index: number, total: number): number {
  return 35 + Math.round(((index + 1) / total) * 40);
}

function buildCompletedDiscussionMessage(degraded: boolean): string {
  return degraded ? '讨论已完成，但部分专家未能回复。' : '讨论已完成，综合结论已生成。';
}

export function createDiscussionEventPublisher(publish: EventPublisher): DiscussionEventPublisher {
  return {
    toolProgress(tool, stage, status, progress, message, executor) {
      publishProgress(publish, tool, stage, status, progress, message, executor);
    },
    consultMatchingExpert() {
      publishProgress(publish, 'consult_the_agency', 'matching-expert', 'started', 8, '正在匹配最合适的顾问');
    },
    consultHiringExpert(expertName) {
      publishProgress(publish, 'consult_the_agency', 'hiring-expert', 'running', 24, `正在让 ${expertName} 入职`);
    },
    consultExecutingExpert(task, agentId, agentName) {
      publish({
        type: 'AGENT_WORKING',
        topic: task,
        agentId,
        agentName,
        task,
      });
      publishProgress(publish, 'consult_the_agency', 'executing-expert', 'running', 62, `${agentName} 正在给出建议`);
    },
    consultCompleted(taskOrExpertName, agentIdOrExecutor, expertName, executor) {
      if (typeof expertName !== 'string') {
        const expertNameOnly = taskOrExpertName;
        const executorOnly = agentIdOrExecutor as ExecutorName | undefined;
        publishProgress(publish, 'consult_the_agency', 'completed', 'completed', 100, `${expertNameOnly} 已提交建议`, executorOnly);
        return;
      }

      const task = taskOrExpertName;
      const agentId = agentIdOrExecutor as string;
      publish({
        type: 'AGENT_TASK_COMPLETED',
        task,
        agentId,
        agentName: expertName,
      });
      publishProgress(publish, 'consult_the_agency', 'completed', 'completed', 100, `${expertName} 已提交建议`, executor);
    },
    discussionPreparing(topic) {
      publishProgress(publish, 'expert_discussion', 'preparing-squad', 'started', 5, `正在准备讨论阵容：${topic}`);
    },
    discussionHiringExperts(topic) {
      publishProgress(publish, 'expert_discussion', 'hiring-experts', 'running', 16, `正在补齐讨论专家阵容：${topic}`);
    },
    discussionAssigningTasks(topic) {
      publishProgress(publish, 'expert_discussion', 'assigning-tasks', 'running', 28, `正在为每位专家分配独立任务：${topic}`);
    },
    discussionCollectingReply(topic, participant, index, total) {
      publish({
        type: 'AGENT_ASSIGNED',
        topic,
        agentId: participant.id,
        agentName: participant.name,
        task: participant.assignment,
      });
      publish({
        type: 'AGENT_WORKING',
        topic,
        agentId: participant.id,
        agentName: participant.name,
        task: participant.assignment,
      });
      publishProgress(
        publish,
        'expert_discussion',
        'collecting-replies',
        'running',
        getReplyProgress(index, total),
        `${participant.name} 正在生成专家回复`,
      );
    },
    discussionParticipantFailed(topic, participant, reason) {
      publish({
        type: 'AGENT_TASK_FAILED',
        topic,
        task: participant.assignment,
        agentId: participant.id,
        agentName: participant.name,
        message: reason,
      });
      publishProgress(
        publish,
        'expert_discussion',
        'collecting-replies',
        'failed',
        35,
        `${participant.name} 未能生成专家回复：${reason}`,
      );
    },
    discussionSynthesizing(topic) {
      publishProgress(publish, 'expert_discussion', 'synthesizing', 'running', 84, `主持人正在综合专家意见：${topic}`);
    },
    discussionStarted(topic, participants, hiredAgentIds) {
      publish({
        type: 'DISCUSSION_STARTED',
        topic,
        participantCount: participants.length,
        participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
        hiredAgentIds,
      });
    },
    discussionCompleted(topic, participants, degraded = false) {
      publish({
        type: 'DISCUSSION_COMPLETED',
        topic,
        participantCount: participants.length,
        participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
        message: buildCompletedDiscussionMessage(degraded),
      });
      publishProgress(
        publish,
        'expert_discussion',
        'completed',
        'completed',
        100,
        buildCompletedDiscussionMessage(degraded),
      );
    },
    agentAssigned(topic, participant) {
      publish({
        type: 'AGENT_ASSIGNED',
        topic,
        agentId: participant.id,
        agentName: participant.name,
        task: participant.assignment,
      });
    },
    agentWorking(topic, participant) {
      publish({
        type: 'AGENT_WORKING',
        topic,
        agentId: participant.id,
        agentName: participant.name,
        task: participant.assignment,
      });
    },
    agentTaskCompleted(task, participant) {
      publish({
        type: 'AGENT_TASK_COMPLETED',
        task,
        agentId: participant.id,
        agentName: participant.name,
      });
    },
    agentTaskFailed(task, participant, reason) {
      publish({
        type: 'AGENT_TASK_FAILED',
        task,
        agentId: participant.id,
        agentName: participant.name,
        message: reason,
      });
    },
    agentHired(agentId, agentName) {
      publish({ type: 'AGENT_HIRED', agentId, agentName });
    },
  };
}
