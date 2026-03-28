'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
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
  executor?: 'claude' | 'codex' | 'openai';
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

  const { status: wsStatus } = useGlobalWebSocket({
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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AI员工</span>
            <span>管理中心</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">管理系统</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            总览
          </Link>
          <Link href="/market" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            人才市场
          </Link>
          <Link href="/organization" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            组织架构
          </Link>
          <Link href="/tasks" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            工作任务
          </Link>
          <Link href="/brainstorm" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm">
            专家协作
          </Link>
          <Link href="/knowledge" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            知识资产
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">系统状态</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {wsStatus === 'connected' ? '已连接' : '同步中...'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">专家协作</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">围绕议题发起多专家讨论与顾问求解</p>
          </div>
        </header>

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
      </main>
    </div>
  );
}
