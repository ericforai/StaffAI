'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, FolderHeart, Save, Search, Sparkles } from 'lucide-react';
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
import { useTaskEventFeed } from '../hooks/useTaskEventFeed';

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

function taskEventToneClass(tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return 'text-emerald-700';
    case 'warning':
      return 'text-amber-700';
    case 'danger':
      return 'text-rose-700';
    case 'info':
      return 'text-sky-700';
    default:
      return 'text-slate-600';
  }
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
  const {
    latestTaskWorkspaceSummary,
    latestApprovalWorkspaceSummary,
    latestExecutionWorkspaceSummary,
    loading: taskEventFeedLoading,
  } = useTaskEventFeed();

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
      task: data.type === 'TOOL_PROGRESS' || data.type === 'TASK_EVENT' ? data.message : data.task,
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
        'TASK_EVENT',
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

  const workspaceCards = useMemo(
    () => [
      {
        href: '/tasks',
        label: '任务工作区',
        detail: '查看任务列表、状态与详情',
        summary: latestTaskWorkspaceSummary,
      },
      {
        href: '/approvals',
        label: '审批队列',
        detail: '查看高风险任务审批状态',
        summary: latestApprovalWorkspaceSummary,
      },
      {
        href: '/tasks',
        label: '执行入口',
        detail: '后续这里将承接 execution 工作区',
        summary: latestExecutionWorkspaceSummary,
      },
    ],
    [latestApprovalWorkspaceSummary, latestExecutionWorkspaceSummary, latestTaskWorkspaceSummary]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(181,210,222,0.45),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(229,206,181,0.38),transparent_22%),linear-gradient(180deg,#f8f5ef_0%,#f4efe6_48%,#f1ece3_100%)] text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-5 xl:px-6">
        <div className="mb-5 grid gap-4 rounded-[2.3rem] border border-[#dfd5c8] bg-[#fffdfa]/92 px-7 py-7 shadow-[0_24px_70px_rgba(128,110,82,0.10)] xl:grid-cols-[1.28fr_0.72fr]">
          <div>
            <p className="text-[11px] font-black tracking-[0.28em] text-[#8c7560]">AGENCY 指挥台</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              更安静、更清楚的多专家工作台
            </h1>

            <p className="mt-4 max-w-3xl text-[17px] leading-8 text-slate-600">
              这次把整个界面往“工作台”而不是“后台工具”推进了一步。信息仍然完整，但层级更轻、阅读更顺，左侧看阵容，中间选专家，右侧推进讨论，不需要在一屏里和太多边框与深色块对抗。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['在职专家', String(activeIds.length)],
              ['模板存档', String(templates.length)],
              ['活跃部门', String(Object.keys(deptStats).length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.5rem] border border-[#e6ddd2] bg-[#fbf7f1] px-4 py-5">
                <p className="text-[11px] font-black tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-3 rounded-[2rem] border border-[#dfd5c8] bg-[#fffdfa]/88 p-4 md:grid-cols-3">
          {workspaceCards.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="rounded-[1.55rem] border border-[#ebe2d7] bg-[#fcf9f4] px-5 py-5 transition-all hover:border-[#cfbfac] hover:bg-[#f7f1e8]"
            >
              <p className="text-lg font-black tracking-tight text-slate-900">{item.label}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.detail}</p>
              {item.summary && (
                <p className={`mt-4 text-xs leading-6 ${taskEventToneClass(item.summary.tone)}`}>
                  最新事件：{item.summary.label} · {item.summary.detail}
                </p>
              )}
              {!taskEventFeedLoading && !item.summary && (
                <p className="mt-3 text-xs leading-6 text-slate-500">暂无任务事件</p>
              )}
            </Link>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[19rem_minmax(0,1.16fr)_23.5rem]">
          <aside className="flex min-h-0 flex-col gap-4">
            <section className="rounded-[2rem] border border-[#dfd5c8] bg-[#fffdfa]/94 p-5 shadow-[0_14px_44px_rgba(128,110,82,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.22em] text-slate-500">小队存档</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">常用阵容</h2>
                </div>
                {activeIds.length > 0 && (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="rounded-full border border-[#ddd3c7] bg-[#f7f2ea] p-2 text-slate-600 transition-all hover:border-[#b7a894] hover:text-slate-900"
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
                    className="flex w-full items-center justify-between rounded-[1.2rem] border border-[#e5ddd2] bg-[#f7f3ed] px-4 py-4 text-left transition-all hover:border-[#c6b9a8] hover:bg-[#f1ebe2]"
                  >
                    <div className="flex items-center gap-3">
                      <FolderHeart className="h-4 w-4 text-[#b16f6f]" />
                      <span className="text-sm font-black text-slate-900">{template.name}</span>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">
                      {template.activeAgentIds.length}
                    </span>
                  </button>
                ))}

                {templates.length === 0 && (
                  <div className="rounded-[1.2rem] border border-dashed border-[#d9d0c4] bg-[#f7f3ed] px-4 py-4 text-sm leading-7 text-slate-600">
                    还没有保存的小队模板。先在左侧或讨论控制台保存一组阵容。
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-[2rem] border border-[#dfd5c8] bg-[#fffdfa]/94 p-5 shadow-[0_14px_44px_rgba(128,110,82,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.22em] text-slate-500">当前阵容</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">在岗专家</h2>
                </div>
                <div className="rounded-full border border-[#ddd3c7] bg-[#f7f2ea] px-3 py-1 text-[11px] font-black text-slate-600">
                  {activeIds.length} 位在岗
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
                  <div className="rounded-[1.2rem] border border-dashed border-[#d9d0c4] bg-[#f7f3ed] px-4 py-5 text-sm leading-7 text-slate-600">
                    当前没有在职专家。你可以从中间人才池加入，或者直接在右侧讨论控制台搜索并雇佣。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#dfd5c8] bg-[#fffdfa]/94 p-5 shadow-[0_14px_44px_rgba(128,110,82,0.08)]">
              <ActivityLog activities={activities} wsStatus={wsStatus} />
            </section>
          </aside>

          <main className="flex min-h-0 flex-col gap-4">
            <section className="rounded-[2rem] border border-[#dfd5c8] bg-[#fffdfa]/94 p-5 shadow-[0_14px_44px_rgba(128,110,82,0.08)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.22em] text-slate-500">人才池</p>
                  <div className="mt-2 flex items-center gap-4">
                    <div
                      onClick={() => {
                        setCurrentDept(null);
                        setSearch('');
                      }}
                      className="cursor-pointer"
                    >
                      <h2 className={`text-3xl font-black tracking-tight md:text-4xl ${!currentDept ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                        专家发现板
                      </h2>
                    </div>

                    {currentDept && (
                      <div className="flex items-center gap-3 rounded-full border border-[#ddd3c7] bg-[#f7f2ea] px-4 py-2">
                        <ChevronLeft
                          className="h-4 w-4 cursor-pointer text-slate-500 transition-colors hover:text-slate-800"
                          onClick={() => setCurrentDept(null)}
                        />
                        <span className="text-sm font-black text-slate-900">{DEPT_MAP[currentDept]?.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索专家能力、角色、领域..."
                    className="w-full rounded-full border border-[#ddd3c7] bg-[#f7f2ea] py-3 pl-12 pr-5 text-base text-slate-800 outline-none transition-all focus:border-[#b7a894] focus:bg-white"
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
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      key={key}
                      onClick={() => setCurrentDept(key)}
                    className="relative overflow-hidden rounded-[1.7rem] border border-[#e6ddd2] bg-[#fffaf5] p-6 text-left shadow-[0_12px_30px_rgba(128,110,82,0.08)] transition-all hover:border-[#cfbfac] hover:bg-[#f8f1e8]"
                    >
                      <Icon className="absolute right-[-10px] top-[-10px] h-20 w-20 text-[#ede5d9]" />
                      <div className="mb-6 inline-flex rounded-[1.35rem] bg-[#f1e9df] p-3 text-slate-700">
                        <Icon className="h-6 w-6" />
                      </div>
                      <p className="text-xl font-black tracking-tight text-slate-900">{dept.label}</p>
                      <p className="mt-2 text-base leading-7 text-slate-600">{deptStats[key] || 0} 位专家待命</p>
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
              <section className="rounded-[2rem] border border-dashed border-[#d9d0c4] bg-[#f7f3ed] px-6 py-10 text-center text-slate-600">
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

        <div className="mt-5 flex items-center justify-between rounded-[1.8rem] border border-[#dfd5c8] bg-[#fffdfa]/88 px-5 py-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#9b8164]" />
            现在的信息流更接近真实工作顺序，而不是把所有能力都堆成一个后台面板。
          </div>
          <div className="font-black tracking-[0.2em] text-slate-500">精修版布局</div>
        </div>
      </div>
    </div>
  );
}
