'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, FolderHeart, Save, Search, Sparkles, TerminalSquare } from 'lucide-react';
import { motion } from 'framer-motion';

import { AgentCard } from '../components/AgentCard';
import { DiscussionControlPanel } from '../components/DiscussionControlPanel';
import { SaveTemplateModal } from '../components/SaveTemplateModal';
import { ActivityLog, ActivityLog as ActivityLogType } from '../components/ActivityLog';

import { useAgents } from '../hooks/useAgents';
import { useWebSocket, WsMessage } from '../hooks/useWebSocket';
import type { DiscussionExpert } from '../hooks/useDiscussionControl';
import { useFindExpertsAction } from '../hooks/useFindExpertsAction';
import { useHireExpertsAction } from '../hooks/useHireExpertsAction';
import { useExpertDiscussionAction } from '../hooks/useExpertDiscussionAction';
import { useConsultAgencyAction } from '../hooks/useConsultAgencyAction';
import { useReportTaskResultAction } from '../hooks/useReportTaskResultAction';
import { useRuntimeFoundation } from '../hooks/useRuntimeFoundation';

import { DEPT_MAP, API_CONFIG } from '../utils/constants';

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

export default function Dashboard() {
  const { agents, activeIds, toggleAgent, saveSquad, syncSquad } = useAgents();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [currentDept, setCurrentDept] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showDiscussionSaveInput, setShowDiscussionSaveInput] = useState(false);
  const [newDiscussionTemplateName, setNewDiscussionTemplateName] = useState('');
  const [activities, setActivities] = useState<ActivityLogType[]>([]);
  const [workingAgentId, setWorkingAgentId] = useState<string | null>(null);
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

  const { status: wsStatus } = useWebSocket({
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

  function handleWsMessage(data: WsMessage) {
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

    const newLog: ActivityLogType = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agentName: data.agentName || (data.type === 'CONNECTED' ? '系统中心' : '指挥部'),
      type: data.type as ActivityLogType['type'],
      task: data.type === 'TOOL_PROGRESS' ? data.message : data.task,
    };

    if (data.type === 'AGENT_WORKING' || data.type === 'AGENT_ASSIGNED') {
      if (data.agentId) {
        setWorkingAgentId(data.agentId);
        setTimeout(() => setWorkingAgentId(null), 3000);
      }
      setActivities((prev) => [newLog, ...prev].slice(0, 20));
    } else if (
      [
        'AGENT_HIRED',
        'AGENT_FIRED',
        'SQUAD_UPDATED',
        'CONNECTED',
        'AGENT_TASK_COMPLETED',
        'DISCUSSION_STARTED',
        'DISCUSSION_COMPLETED',
        'TOOL_PROGRESS',
      ].includes(data.type)
    ) {
      setActivities((prev) => [newLog, ...prev].slice(0, 20));
    }
  }

  const handleSaveTemplate = async () => {
    if (!newTemplateName) return;

    await fetch(`${API_CONFIG.BASE_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTemplateName, activeAgentIds: activeIds }),
    });

    setNewTemplateName('');
    setShowSaveInput(false);
    fetchTemplates();
  };

  const handleSaveDiscussionTemplate = async () => {
    if (!newDiscussionTemplateName || expertDiscussionAction.agentIds.length === 0) return;

    await fetch(`${API_CONFIG.BASE_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDiscussionTemplateName,
        activeAgentIds: expertDiscussionAction.agentIds,
      }),
    });

    setNewDiscussionTemplateName('');
    setShowDiscussionSaveInput(false);
    fetchTemplates();
  };

  const applyTemplate = (template: Template) => saveSquad(template.activeAgentIds);
  const applyDiscussionTemplate = (template: Template) =>
    expertDiscussionAction.setAgentIds(Array.from(new Set(template.activeAgentIds)));

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          (search
            ? agent.frontmatter.name.toLowerCase().includes(search.toLowerCase()) ||
              agent.frontmatter.description.toLowerCase().includes(search.toLowerCase())
            : true) && (!currentDept || agent.department === currentDept)
      ),
    [agents, search, currentDept]
  );

  const deptStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const agent of agents) {
      stats[agent.department] = (stats[agent.department] || 0) + 1;
    }
    return stats;
  }, [agents]);

  const activeAgents = useMemo(() => agents.filter((agent) => activeIds.includes(agent.id)), [agents, activeIds]);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(28,117,188,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(17,212,185,0.12),transparent_28%),#070b12] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4 xl:px-6">
        <div className="mb-4 grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_25px_80px_rgba(0,0,0,0.28)] xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 flex items-center gap-4">
              <div className="rounded-[1.7rem] bg-gradient-to-br from-cyan-400 to-blue-600 p-4 shadow-[0_15px_40px_rgba(34,211,238,0.28)]">
                <TerminalSquare className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-300/80">The Agency HQ</p>
                <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Multi-Agent Command Deck</h1>
              </div>
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
              这里不是传统的工具堆叠页，而是一块为专家编组、任务分配和讨论综合而设计的指挥台。左侧管理组织和日志，中间挑选人才与查看阵容，右侧驱动真实多代理讨论。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['在职专家', String(activeIds.length)],
              ['模板存档', String(templates.length)],
              ['活跃部门', String(Object.keys(deptStats).length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.6rem] border border-white/10 bg-[#0d1118]/85 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)_32rem]">
          <aside className="flex min-h-0 flex-col gap-4">
            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,21,32,0.96),rgba(10,14,22,0.96))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/70">Squad Storage</p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-white">公司预设存档</h2>
                </div>
                {activeIds.length > 0 && (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition-all hover:border-cyan-400/40 hover:text-white"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                )}
              </div>

              <SaveTemplateModal
                show={showSaveInput}
                value={newTemplateName}
                onChange={setNewTemplateName}
                onSave={handleSaveTemplate}
                onCancel={() => {
                  setShowSaveInput(false);
                  setNewTemplateName('');
                }}
              />

              <div className="space-y-3">
                {templates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => applyTemplate(template)}
                    className="flex w-full items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition-all hover:border-cyan-400/30 hover:bg-cyan-400/8"
                  >
                    <div className="flex items-center gap-3">
                      <FolderHeart className="h-4 w-4 text-rose-300" />
                      <span className="text-sm font-black text-white">{template.name}</span>
                    </div>
                    <span className="rounded-full bg-[#0d1118] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {template.activeAgentIds.length}
                    </span>
                  </button>
                ))}

                {templates.length === 0 && (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-[#0d1118] px-4 py-4 text-sm text-slate-500">
                    还没有保存的小队模板。先在左侧或讨论控制台保存一组阵容。
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(13,17,24,0.96),rgba(10,14,22,0.94))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/70">Active Roster</p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-white">在职专家名单</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  {activeIds.length} online
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                {activeAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={true}
                    isWorking={workingAgentId === agent.id}
                    variant="sidebar"
                    onToggle={toggleAgent}
                  />
                ))}

                {activeAgents.length === 0 && (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-[#0d1118] px-4 py-5 text-sm text-slate-500">
                    当前没有在职专家。你可以从中间人才池加入，或者直接在右侧讨论控制台搜索并雇佣。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(13,17,24,0.96),rgba(10,14,22,0.94))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              <ActivityLog activities={activities} wsStatus={wsStatus} />
            </section>
          </aside>

          <main className="flex min-h-0 flex-col gap-4">
            <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,20,30,0.96),rgba(10,14,22,0.94))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300/70">Talent Pool</p>
                  <div className="mt-2 flex items-center gap-4">
                    <div
                      onClick={() => {
                        setCurrentDept(null);
                        setSearch('');
                      }}
                      className="cursor-pointer"
                    >
                      <h2 className={`text-3xl font-black tracking-tight md:text-4xl ${!currentDept ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                        Expert Discovery Board
                      </h2>
                    </div>

                    {currentDept && (
                      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                        <ChevronLeft
                          className="h-4 w-4 cursor-pointer text-slate-500 transition-colors hover:text-cyan-300"
                          onClick={() => setCurrentDept(null)}
                        />
                        <span className="text-sm font-black text-white">{DEPT_MAP[currentDept]?.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    type="text"
                    placeholder="搜索专家能力、角色、领域..."
                    className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 pl-12 pr-5 text-sm text-white outline-none transition-all focus:border-cyan-400/40 focus:bg-white/[0.06]"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (event.target.value) setCurrentDept(null);
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {!currentDept && !search &&
                Object.entries(DEPT_MAP).map(([key, dept]) => {
                  const Icon = dept.icon;
                  return (
                    <motion.button
                      whileHover={{ y: -4, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      key={key}
                      onClick={() => setCurrentDept(key)}
                      className={`relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-gradient-to-br ${dept.gradient} p-6 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition-all hover:border-cyan-400/30`}
                    >
                      <Icon className="absolute right-[-10px] top-[-10px] h-20 w-20 text-white/[0.03]" />
                      <div className={`mb-5 inline-flex rounded-2xl bg-white/[0.08] p-3 ${dept.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <p className="text-xl font-black tracking-tight text-white">{dept.label}</p>
                      <p className="mt-2 text-sm text-slate-400">{deptStats[key] || 0} 位专家待命</p>
                    </motion.button>
                  );
                })}

              {(currentDept || search) &&
                filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={activeIds.includes(agent.id)}
                    isWorking={workingAgentId === agent.id}
                    variant="grid"
                    onClick={toggleAgent}
                  />
                ))}
            </section>

            {(currentDept || search) && filteredAgents.length === 0 && (
              <section className="rounded-[2rem] border border-dashed border-white/10 bg-[#0d1118]/85 px-6 py-10 text-center text-slate-500">
                当前筛选下没有匹配专家。试试切换部门，或换一种更具体的能力关键词。
              </section>
            )}
          </main>

          <aside className="min-h-0">
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
              showSaveTemplateInput={showDiscussionSaveInput}
              saveTemplateName={newDiscussionTemplateName}
              onChangeSaveTemplateName={setNewDiscussionTemplateName}
              onConfirmSaveTemplate={handleSaveDiscussionTemplate}
              onCancelSaveTemplate={() => {
                setShowDiscussionSaveInput(false);
                setNewDiscussionTemplateName('');
              }}
              onToggleSelection={expertDiscussionAction.toggleAgentId}
              onSearchExperts={handleSearchExperts}
              onHireSelected={handleHireSelected}
              onRunDiscussion={handleRunDiscussion}
              onApplyTemplate={applyDiscussionTemplate}
              onSaveCurrentSelection={() => setShowDiscussionSaveInput(true)}
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
          </aside>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            现在的布局把专家池、组织状态和讨论执行拆成三块主区域，避免控制台像悬浮挂件一样挤在角落。
          </div>
          <div className="font-black uppercase tracking-[0.24em] text-slate-600">HQ Layout v3</div>
        </div>
      </div>
    </div>
  );
}
