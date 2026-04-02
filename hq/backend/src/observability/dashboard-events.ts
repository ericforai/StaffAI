export interface DashboardEvent {
  type: string;
  activeAgentIds?: string[];
  agentId?: string;
  agentName?: string;
  task?: string;
  topic?: string;
  tool?: 'consult_the_agency' | 'expert_discussion';
  stage?: string;
  message?: string;
  progress?: number;
  status?: 'started' | 'running' | 'completed' | 'failed';
  executor?: 'codex' | 'claude' | 'gemini' | 'openai' | 'deerflow';
  participantCount?: number;
  participants?: Array<{ id: string; name: string }>;
  hiredAgentIds?: string[];
  // For proactive proposals
  intentId?: string;
  objective?: string;
  metricGap?: string;
}
