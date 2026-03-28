'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGlobalWebSocket, type WsMessage } from '../../hooks/useGlobalWebSocket';
import { DiscussionControlPanel } from '../../components/DiscussionControlPanel';
import { useFindExpertsAction } from '../../hooks/useFindExpertsAction';
import { useHireExpertsAction } from '../../hooks/useHireExpertsAction';
import { useExpertDiscussionAction } from '../../hooks/useExpertDiscussionAction';
import { useConsultAgencyAction } from '../../hooks/useConsultAgencyAction';
import { useReportTaskResultAction } from '../../hooks/useReportTaskResultAction';
import { useRuntimeFoundation } from '../../hooks/useRuntimeFoundation';
import { useAgents } from '../../hooks/useAgents';
import { API_CONFIG } from '../../utils/constants';
import type { DiscussionExpert } from '../../hooks/useDiscussionControl';

interface Template {
  name: string;
  activeAgentIds: string[];
}

interface ToolProgressState {
  stage: string;
  message: string;
  progress: number;
  status: 'idle' | 'started' | 'running' | 'completed' | 'failed';
  executor?: 'claude' | 'codex' | 'openai' | 'deerflow';
}

export default function BrainstormPage() {
  const { agents, activeIds, syncSquad } = useAgents();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [consultProgress, setConsultProgress] = useState<ToolProgressState>({
    stage: 'idle',
    message: '准备接收顾问请求',
    progress: 0,
    status: 'idle',
  });
  const [discussionProgress, setDiscussionProgress] = useState<ToolProgressState>({
    stage: 'idle',
    message: '准备组织专家讨论',
    progress: 0,
    status: 'idle',
  });

  const findExpertsAction = useFindExpertsAction();
  const hireExpertsAction = useHireExpertsAction();
  const expertDiscussionAction = useExpertDiscussionAction();
  const consultAgencyAction = useConsultAgencyAction();
  const reportTaskResultAction = useReportTaskResultAction();
  const runtimeFoundation = useRuntimeFoundation(expertDiscussionAction.topic, activeIds);

  const handleWsMessage = useCallback((data: WsMessage) => {
    if (['SQUAD_UPDATED', 'AGENT_HIRED', 'AGENT_FIRED'].includes(data.type)) {
      syncSquad();
    }

    if (data.type === 'TOOL_PROGRESS' && data.tool && data.message && typeof data.progress === 'number') {
      const nextState: ToolProgressState = {
        stage: data.stage || 'running',
        message: data.message,
        progress: data.progress,
        status: data.status || 'running',
        executor: data.executor,
      };

      if (data.tool === 'consult_the_agency') {
        setConsultProgress(nextState);
      }

      if (data.tool === 'expert_discussion') {
        setDiscussionProgress(nextState);
      }
    }

  }, [syncSquad]);

  useGlobalWebSocket({
    onMessage: handleWsMessage,
  });

  const fetchTemplates = useCallback(
    () =>
      fetch(`${API_CONFIG.BASE_URL}/templates`)
        .then((res) => res.json())
        .then(setTemplates),
    []
  );

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    void expertDiscussionAction.refreshCapabilities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveDiscussionTemplate = async () => {
    if (!newTemplateName || expertDiscussionAction.agentIds.length === 0) return;

    await fetch(`${API_CONFIG.BASE_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTemplateName,
        activeAgentIds: expertDiscussionAction.agentIds,
      }),
    });

    setNewTemplateName('');
    setShowSaveInput(false);
    fetchTemplates();
  };

  const experts = useMemo<DiscussionExpert[]>(() => {
    const merged = new Map<string, DiscussionExpert>();

    for (const expert of findExpertsAction.result?.experts ?? []) {
      merged.set(expert.id, {
        id: expert.id,
        name: expert.name,
        description: expert.description,
        department: expert.department,
        score: expert.score,
        isActive: expert.isActive || activeIds.includes(expert.id),
      });
    }

    for (const agentId of expertDiscussionAction.agentIds) {
      if (merged.has(agentId)) {
        continue;
      }

      const agent = agents.find((entry) => entry.id === agentId);
      if (!agent) {
        continue;
      }

      merged.set(agent.id, {
        id: agent.id,
        name: agent.frontmatter.name,
        description: agent.frontmatter.description,
        department: agent.department,
        score: 0,
        isActive: activeIds.includes(agent.id),
      });
    }

    return Array.from(merged.values());
  }, [activeIds, agents, expertDiscussionAction.agentIds, findExpertsAction.result?.experts]);

  const reportAgentOptions = useMemo(
    () =>
      (expertDiscussionAction.result?.participants ?? experts.filter((expert) => expertDiscussionAction.agentIds.includes(expert.id))).map(
        (expert) => ({
          id: expert.id,
          name: expert.name,
        })
      ),
    [expertDiscussionAction.agentIds, expertDiscussionAction.result?.participants, experts]
  );

  const discussionError =
    expertDiscussionAction.error ||
    findExpertsAction.error ||
    hireExpertsAction.error ||
    consultAgencyAction.error ||
    reportTaskResultAction.error;

  const setDiscussionTopic = useCallback(
    (value: string) => {
      expertDiscussionAction.setTopic(value);
      findExpertsAction.setTopic(value);
      consultAgencyAction.setTask(value);
      reportTaskResultAction.setTask(value);
    },
    [consultAgencyAction, expertDiscussionAction, findExpertsAction, reportTaskResultAction]
  );

  const handleSearchExperts = useCallback(async () => {
    const result = await findExpertsAction.findExperts({
      topic: expertDiscussionAction.topic,
      maxExperts: expertDiscussionAction.participantCount,
    });
    if (result) {
      expertDiscussionAction.setAgentIds(
        result.experts.slice(0, expertDiscussionAction.participantCount).map((expert) => expert.id)
      );
    }
  }, [expertDiscussionAction, findExpertsAction]);

  const handleHireSelected = useCallback(async () => {
    const result = await hireExpertsAction.execute(expertDiscussionAction.agentIds);
    if (result) {
      syncSquad();
    }
  }, [expertDiscussionAction.agentIds, hireExpertsAction, syncSquad]);

  const handleRunDiscussion = useCallback(async () => {
    setDiscussionProgress({
      stage: 'booting',
      message: '正在启动讨论流程',
      progress: 2,
      status: 'started',
    });
    const result = await expertDiscussionAction.runDiscussion({
      topic: expertDiscussionAction.topic,
      participantCount: expertDiscussionAction.participantCount,
      agentIds: expertDiscussionAction.agentIds,
    });

    if (result) {
      syncSquad();
      reportTaskResultAction.setTask(result.topic);
      reportTaskResultAction.setResultSummary(result.synthesis);
      const firstParticipant = result.participants[0];
      if (firstParticipant) {
        reportTaskResultAction.setAgentId(firstParticipant.id);
      }
    }
  }, [expertDiscussionAction, reportTaskResultAction, syncSquad]);

  const handleConsultAgency = useCallback(async () => {
    setConsultProgress({
      stage: 'booting',
      message: '正在连接顾问工具',
      progress: 2,
      status: 'started',
    });
    await consultAgencyAction.execute(expertDiscussionAction.topic);
  }, [consultAgencyAction, expertDiscussionAction.topic]);

  const handleStructuredDiscussionAction = useCallback(
    async (actionKey: 'switch_client' | 'auto_downgrade' | 'single_expert') => {
      if (actionKey === 'auto_downgrade') {
        expertDiscussionAction.setExecutionMode('auto');
        return;
      }
      if (actionKey === 'single_expert') {
        await handleConsultAgency();
      }
    },
    [expertDiscussionAction, handleConsultAgency]
  );

  const handleReportTaskResult = useCallback(async () => {
    await reportTaskResultAction.reportTaskResult();
  }, [reportTaskResultAction]);

  const applyDiscussionTemplate = (template: Template) =>
    expertDiscussionAction.setAgentIds(Array.from(new Set(template.activeAgentIds)));

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mx-auto w-full max-w-[1800px]">
        <DiscussionControlPanel
          topic={expertDiscussionAction.topic}
          setTopic={setDiscussionTopic}
          participantCount={expertDiscussionAction.participantCount}
          setParticipantCount={expertDiscussionAction.setParticipantCount}
          experts={experts}
          selectedAgentIds={expertDiscussionAction.agentIds}
          result={expertDiscussionAction.result}
          templates={templates}
          error={discussionError}
          searching={findExpertsAction.loading}
          hiring={hireExpertsAction.loading}
          running={expertDiscussionAction.loading}
          showSaveTemplateInput={showSaveInput}
          saveTemplateName={newTemplateName}
          onChangeSaveTemplateName={setNewTemplateName}
          onConfirmSaveTemplate={handleSaveDiscussionTemplate}
          onCancelSaveTemplate={() => {
            setShowSaveInput(false);
            setNewTemplateName('');
          }}
          onToggleSelection={expertDiscussionAction.toggleAgentId}
          onSearchExperts={handleSearchExperts}
          onHireSelected={handleHireSelected}
          onRunDiscussion={handleRunDiscussion}
          onApplyTemplate={applyDiscussionTemplate}
          onSaveCurrentSelection={() => setShowSaveInput(true)}
          consultResult={consultAgencyAction.result}
          consulting={consultAgencyAction.loading}
          onConsultAgency={handleConsultAgency}
          reportTask={reportTaskResultAction.task}
          setReportTask={reportTaskResultAction.setTask}
          reportAgentId={reportTaskResultAction.agentId}
          setReportAgentId={reportTaskResultAction.setAgentId}
          reportSummary={reportTaskResultAction.resultSummary}
          setReportSummary={reportTaskResultAction.setResultSummary}
          reportResult={reportTaskResultAction.result}
          reporting={reportTaskResultAction.loading}
          reportAgentOptions={reportAgentOptions}
          onReportTaskResult={handleReportTaskResult}
          consultProgress={consultProgress}
          discussionProgress={discussionProgress}
          samplingEnabled={expertDiscussionAction.capabilities?.sampling ?? null}
          capabilitiesLoading={expertDiscussionAction.capabilitiesLoading}
          executionMode={expertDiscussionAction.executionMode}
          setExecutionMode={expertDiscussionAction.setExecutionMode}
          structuredError={expertDiscussionAction.errorDetails}
          onStructuredAction={handleStructuredDiscussionAction}
          runtimeHost={runtimeFoundation.currentHost}
          runtimeHosts={runtimeFoundation.hosts}
          runtimeCapabilities={runtimeFoundation.capabilities}
          runtimeRecommendations={runtimeFoundation.recommendations}
          runtimeStateDir={runtimeFoundation.runtimeStateDir}
          runtimeLoading={runtimeFoundation.loading}
          runtimeError={runtimeFoundation.error}
          selectedHostId={runtimeFoundation.selectedHostId}
          onSelectHost={runtimeFoundation.setSelectedHostId}
        />
      </div>
    </div>
  );
}
