'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpenText, BrainCircuit, Building2, ChevronLeft, ClipboardList, FolderHeart, Save, Search, Store } from 'lucide-react';
import { motion } from 'framer-motion';

import { AgentCard } from '../components/AgentCard';
import { DiscussionControlPanel } from '../components/DiscussionControlPanel';
import { TaskWorkspacePanel } from '../components/TaskWorkspacePanel';
import { SaveTemplateModal } from '../components/SaveTemplateModal';
import { ActivityLog, ActivityLog as ActivityLogType } from '../components/ActivityLog';

import { useAgents } from '../hooks/useAgents';
import { useTasks } from '../hooks/useTasks';
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

type WorkspaceKey = 'market' | 'organization' | 'tasks' | 'brainstorm' | 'knowledge';

type KnowledgeSource = 'discussion' | 'consult' | 'report';

interface KnowledgeEntry {
  id: string;
  signature: string;
  source: KnowledgeSource;
  title: string;
  task: string;
  summary: string;
  content: string;
  agentId?: string;
  agentName?: string;
  createdAt: string;
  tags: string[];
}

export default function Dashboard() {
  const { agents, activeIds, toggleAgent, saveSquad, syncSquad } = useAgents();
  const { tasks, loading: tasksLoading, error: tasksError, reload: reloadTasks } = useTasks();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [currentDept, setCurrentDept] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey>('market');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showDiscussionSaveInput, setShowDiscussionSaveInput] = useState(false);
  const [newDiscussionTemplateName, setNewDiscussionTemplateName] = useState('');
  const [activities, setActivities] = useState<ActivityLogType[]>([]);
  const [workingAgentId, setWorkingAgentId] = useState<string | null>(null);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeSourceFilter, setKnowledgeSourceFilter] = useState<'all' | KnowledgeSource>('all');
  const [knowledgeAgentFilter, setKnowledgeAgentFilter] = useState<'all' | string>('all');
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);
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
    latestSummaryByTaskId,
    latestTaskWorkspaceSummary,
    latestApprovalWorkspaceSummary,
    latestExecutionWorkspaceSummary,
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

  const appendKnowledgeEntry = useCallback((entry: KnowledgeEntry) => {
    setKnowledgeEntries((current) => {
      if (current.some((item) => item.signature === entry.signature)) {
        return current;
      }

      return [entry, ...current];
    });
    setSelectedKnowledgeId(entry.id);
  }, []);

  useEffect(() => {
    const result = expertDiscussionAction.result;
    if (!result) {
      return;
    }

    const participantNames = result.participants.map((participant) => participant.name);
    appendKnowledgeEntry({
      id: `discussion-${result.topic}-${result.synthesis.slice(0, 24)}`,
      signature: `discussion-${result.topic}-${result.synthesis}`,
      source: 'discussion',
      title: result.topic || '专家讨论',
      task: result.topic || '专家讨论',
      summary: result.synthesis.slice(0, 140),
      content: result.synthesis,
      createdAt: new Date().toISOString(),
      tags: participantNames,
    });

    for (const participant of result.participants) {
      appendKnowledgeEntry({
        id: `participant-${participant.id}-${result.topic}-${participant.assignment.slice(0, 24)}`,
        signature: `participant-${participant.id}-${result.topic}-${participant.response || participant.assignment}`,
        source: 'discussion',
        title: `${participant.name} · 专家回复`,
        task: result.topic || participant.assignment,
        summary: participant.assignment,
        content: participant.response || participant.assignment,
        agentId: participant.id,
        agentName: participant.name,
        createdAt: new Date().toISOString(),
        tags: [participant.department, participant.name],
      });
    }
  }, [appendKnowledgeEntry, expertDiscussionAction.result]);

  useEffect(() => {
    const result = consultAgencyAction.result;
    if (!result) {
      return;
    }

    appendKnowledgeEntry({
      id: `consult-${result.task}-${result.text.slice(0, 24)}`,
      signature: `consult-${result.task}-${result.text}`,
      source: 'consult',
      title: result.task || '顾问建议',
      task: result.task || '顾问建议',
      summary: result.text.slice(0, 140),
      content: result.text,
      agentId: result.agentId,
      agentName: result.agentName,
      createdAt: new Date().toISOString(),
      tags: [result.agentName || '顾问建议'].filter(Boolean),
    });
  }, [appendKnowledgeEntry, consultAgencyAction.result]);

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

  useEffect(() => {
    if (!reportTaskResultAction.result?.message) {
      return;
    }

    const agentOption = reportAgentOptions.find((option) => option.id === reportTaskResultAction.agentId);
    appendKnowledgeEntry({
      id: `report-${reportTaskResultAction.task}-${reportTaskResultAction.agentId}-${reportTaskResultAction.resultSummary.slice(0, 24)}`,
      signature: `report-${reportTaskResultAction.task}-${reportTaskResultAction.agentId}-${reportTaskResultAction.resultSummary}`,
      source: 'report',
      title: reportTaskResultAction.task || '知识记录',
      task: reportTaskResultAction.task || '知识记录',
      summary: reportTaskResultAction.resultSummary.slice(0, 140),
      content: reportTaskResultAction.resultSummary,
      agentId: reportTaskResultAction.agentId,
      agentName: agentOption?.name,
      createdAt: new Date().toISOString(),
      tags: [agentOption?.name || '知识库', '知识沉淀'],
    });
  }, [
    appendKnowledgeEntry,
    reportAgentOptions,
    reportTaskResultAction.agentId,
    reportTaskResultAction.result,
    reportTaskResultAction.resultSummary,
    reportTaskResultAction.task,
  ]);

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

  const knowledgeAgentOptions = useMemo(() => {
    const counter = new Map<string, { id: string; name: string; count: number }>();

    for (const entry of knowledgeEntries) {
      if (!entry.agentName) {
        continue;
      }

      const key = entry.agentId || entry.agentName;
      const existing = counter.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }

      counter.set(key, {
        id: key,
        name: entry.agentName,
        count: 1,
      });
    }

    return Array.from(counter.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [knowledgeEntries]);

  const filteredKnowledgeEntries = useMemo(() => {
    return knowledgeEntries.filter((entry) => {
      if (knowledgeSourceFilter !== 'all' && entry.source !== knowledgeSourceFilter) {
        return false;
      }

      if (knowledgeAgentFilter !== 'all') {
        const agentKey = entry.agentId || entry.agentName;
        if (agentKey !== knowledgeAgentFilter) {
          return false;
        }
      }

      if (!knowledgeQuery.trim()) {
        return true;
      }

      const query = knowledgeQuery.trim().toLowerCase();
      return [entry.title, entry.task, entry.summary, entry.content, entry.agentName, ...entry.tags]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [knowledgeAgentFilter, knowledgeEntries, knowledgeQuery, knowledgeSourceFilter]);

  const selectedKnowledgeEntry = useMemo(() => {
    if (!filteredKnowledgeEntries.length) {
      return null;
    }

    return (
      filteredKnowledgeEntries.find((entry) => entry.id === selectedKnowledgeId) ||
      filteredKnowledgeEntries[0]
    );
  }, [filteredKnowledgeEntries, selectedKnowledgeId]);

  const activeWorkspaceMeta = useMemo(() => {
    const workspaceMap: Record<
      WorkspaceKey,
      { label: string; summary: string; detail: string }
    > = {
      market: {
        label: '人才市场',
        summary: '面向招聘、选型与能力发现的专家池视图',
        detail: '按部门浏览角色能力，快速检索合适专家并加入当前协作阵容。',
      },
      organization: {
        label: '组织架构',
        summary: '围绕阵容管理、模板复用与在岗状态的组织视图',
        detail: '统一管理常用小队、当前在岗专家与动态流，适合日常运营编排。',
      },
      tasks: {
        label: '工作任务',
        summary: '统一承接执行入口、审批链路与任务态势',
        detail: '聚合任务状态、最新事件与后续执行入口，减少跨页面切换成本。',
      },
      brainstorm: {
        label: '头脑风暴',
        summary: '围绕议题发起多专家讨论与顾问求解',
        detail: '支持找人、聘用、协同讨论、顾问咨询和结构化进度追踪。',
      },
      knowledge: {
        label: '知识沉淀',
        summary: '围绕历史结论、专家归档与检索回看的知识台',
        detail: '按来源、专家、关键词交叉筛选，形成可复用的业务知识资产。',
      },
    };

    return workspaceMap[activeWorkspace];
  }, [activeWorkspace]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar - Integrated Structural Element */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AGENCY</span>
            <span>HQ CONSOLE</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">指挥部</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {[
            { key: 'market' as WorkspaceKey, label: '系统市场', icon: Store },
            { key: 'organization' as WorkspaceKey, label: '组织阵容', icon: Building2 },
            { key: 'tasks' as WorkspaceKey, label: '作业工作区', icon: ClipboardList },
            { key: 'brainstorm' as WorkspaceKey, label: '专家协作', icon: BrainCircuit },
            { key: 'knowledge' as WorkspaceKey, label: '知识资产', icon: BookOpenText },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeWorkspace === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveWorkspace(item.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-sky-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">System Status</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {wsStatus === 'connected' ? 'Connected' : 'Synchronizing...'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        {/* Top Header Section */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">{activeWorkspaceMeta.label}</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500 max-w-sm truncate">{activeWorkspaceMeta.summary}</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex gap-4">
              {[
                ['Experts', String(activeIds.length)],
                ['Knowledge', String(knowledgeEntries.length)],
              ].map(([label, value]) => (
                <div key={label} className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
                  <p className="text-sm font-bold text-slate-900 leading-none mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px] space-y-5">

            {/* Workspace Content Router */}
            <div className="min-h-0">
              {activeWorkspace === 'market' && (
                <div className="flex flex-col gap-6">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-6">
                        <div
                          onClick={() => {
                            setCurrentDept(null);
                            setSearch('');
                          }}
                          className="cursor-pointer group"
                        >
                          <h2 className={`text-base font-bold tracking-tight transition-colors ${!currentDept ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                            人才总览
                          </h2>
                        </div>

                        {currentDept && (
                          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5">
                            <ChevronLeft
                              className="h-3.5 w-3.5 cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                              onClick={() => setCurrentDept(null)}
                            />
                            <span className="text-xs font-bold text-slate-700">{DEPT_MAP[currentDept]?.label}</span>
                          </div>
                        )}
                      </div>

                      <div className="relative w-full max-w-sm">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="检索职业能力、专业领域..."
                          className="w-full h-10 rounded-md border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-800 outline-none ring-offset-white transition-all focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400"
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            if (event.target.value) setCurrentDept(null);
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
                    {!currentDept && !search &&
                      Object.entries(DEPT_MAP).map(([key, dept]) => {
                        const Icon = dept.icon;
                        return (
                          <motion.button
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            key={key}
                            onClick={() => setCurrentDept(key)}
                            className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="inline-flex rounded-md bg-slate-50 p-2 text-slate-600 border border-slate-100 transition-colors group-hover:bg-slate-100">
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{deptStats[key] || 0} experts</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900">{dept.label}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500 leading-normal">
                              {dept.label} 人才子库
                            </p>
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
                    <section className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-400 text-xs">
                      当前筛选下没有匹配专家。试试切换部门，或换一种更具体的能力关键词。
                    </section>
                  )}
                </div>
              )}

              {activeWorkspace === 'organization' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Archive Management</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">常用阵容模板</h2>
                      </div>
                      {activeIds.length > 0 && (
                        <button
                          onClick={() => setShowSaveInput(true)}
                          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:border-slate-400 hover:text-slate-900"
                        >
                          <Save className="h-3.5 w-3.5" />
                          保存当前
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

                    <div className="space-y-2">
                      {templates.map((template) => (
                        <button
                          key={template.name}
                          onClick={() => applyTemplate(template)}
                          className="group flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 text-left transition-all hover:border-slate-300 hover:bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <FolderHeart className="h-4 w-4 text-slate-400 group-hover:text-sky-600" />
                            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{template.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                            {template.activeAgentIds.length} AGENTS
                          </span>
                        </button>
                      ))}
                      {templates.length === 0 && (
                        <div className="text-center py-8 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                          暂无阵容模板，点击右上角保存当前在岗专家为模板。
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Active Roster</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">在岗专家阵容</h2>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {activeIds.length} ACTIVE
                      </div>
                    </div>
                    <div className="space-y-2">
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
                        <div className="text-center py-8 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                          当前无在岗专家。请前往“系统市场”挑选并聘用。
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="xl:col-span-2 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">系统活动流 / Activity Log</h3>
                    </div>
                    <div className="p-0">
                      <ActivityLog activities={activities} wsStatus={wsStatus} />
                    </div>
                  </section>
                </div>
              )}

              {activeWorkspace === 'tasks' && (
                <TaskWorkspacePanel
                  tasks={tasks}
                  loading={tasksLoading}
                  error={tasksError}
                  latestSummaryByTaskId={latestSummaryByTaskId}
                  latestTaskWorkspaceSummary={latestTaskWorkspaceSummary}
                  latestApprovalWorkspaceSummary={latestApprovalWorkspaceSummary}
                  latestExecutionWorkspaceSummary={latestExecutionWorkspaceSummary}
                  onRefreshTasks={reloadTasks}
                  onOpenDiscussion={() => setActiveWorkspace('brainstorm')}
                />
              )}

              {activeWorkspace === 'brainstorm' && (
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
              )}

              {activeWorkspace === 'knowledge' && (
                <section className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-3">
                    {[
                      { label: '沉淀总览', value: knowledgeEntries.length, detail: '归档结论、专家回复与建议。' },
                      { label: '专家资产', value: knowledgeAgentOptions.length, detail: '追踪不同角色的观点与输出。' },
                      { label: '检出匹配', value: filteredKnowledgeEntries.length, detail: '关键词与维度交叉筛选结果。' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{stat.label}</p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                        <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_180px_180px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={knowledgeQuery}
                        onChange={(event) => setKnowledgeQuery(event.target.value)}
                        placeholder="快速检索任务关键词、结论或专家名称..."
                        className="w-full h-10 rounded-md border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </div>

                    <select
                      value={knowledgeSourceFilter}
                      onChange={(event) => setKnowledgeSourceFilter(event.target.value as 'all' | KnowledgeSource)}
                      className="h-10 rounded-md border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="all">来源：全部</option>
                      <option value="discussion">专家讨论</option>
                      <option value="consult">顾问建议</option>
                      <option value="report">知识记录</option>
                    </select>

                    <select
                      value={knowledgeAgentFilter}
                      onChange={(event) => setKnowledgeAgentFilter(event.target.value)}
                      className="h-10 rounded-md border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="all">专家：全部</option>
                      {knowledgeAgentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} ({option.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[180px_1fr_1.5fr]">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">专家视角</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setKnowledgeAgentFilter('all')}
                          className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs font-bold transition-colors ${
                            knowledgeAgentFilter === 'all'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          全部存档
                          <span className="text-[10px] opacity-60">{knowledgeEntries.length}</span>
                        </button>
                        {knowledgeAgentOptions.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setKnowledgeAgentFilter(option.id)}
                            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${
                              knowledgeAgentFilter === option.id
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate">{option.name}</span>
                            <span className="text-[10px] opacity-60">{option.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">历史列表</p>
                      </div>
                      <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {filteredKnowledgeEntries.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => setSelectedKnowledgeId(entry.id)}
                            className={`w-full rounded-lg border p-4 text-left transition-all ${
                              selectedKnowledgeEntry?.id === entry.id
                                ? 'border-slate-800 bg-slate-50'
                                : 'border-slate-100 bg-white hover:border-slate-300'
                            }`}
                          >
                            <p className="text-xs font-bold text-slate-900 line-clamp-1">{entry.title}</p>
                            <p className="mt-2 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{entry.summary}</p>
                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">{entry.source}</span>
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">详情预览</p>
                      </div>
                      <div className="flex-1 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        {selectedKnowledgeEntry ? (
                          <div className="space-y-8">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600 bg-sky-50 px-2 py-1 rounded">
                                {selectedKnowledgeEntry.source}
                              </span>
                              <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                                {selectedKnowledgeEntry.title}
                              </h3>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">归档项目</p>
                                <p className="mt-1 text-xs font-bold text-slate-700">{selectedKnowledgeEntry.task}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">执行专家</p>
                                <p className="mt-1 text-xs font-bold text-slate-700">{selectedKnowledgeEntry.agentName || '系统流水'}</p>
                              </div>
                            </div>

                            <div className="prose prose-slate prose-sm max-w-none">
                              <p className="text-sm leading-8 text-slate-600 font-medium border-l-4 border-slate-200 pl-4 py-1 italic bg-slate-50/50 rounded-r-lg">
                                {selectedKnowledgeEntry.summary}
                              </p>
                              <div className="mt-8 pt-8 border-t border-slate-100 whitespace-pre-wrap text-sm leading-8 text-slate-700 font-normal">
                                {selectedKnowledgeEntry.content}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                            <BookOpenText className="h-12 w-12 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">Select an entry to view details</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
