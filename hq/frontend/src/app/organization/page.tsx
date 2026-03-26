'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FolderHeart, Save } from 'lucide-react';
import { useAgents } from '../../hooks/useAgents';
import { AgentCard } from '../../components/AgentCard';
import { SaveTemplateModal } from '../../components/SaveTemplateModal';
import { ActivityLog, type ActivityLog as ActivityLogType } from '../../components/ActivityLog';
import { useWebSocket, type WsMessage } from '../../hooks/useWebSocket';
import { API_CONFIG } from '../../utils/constants';

interface Template {
  name: string;
  activeAgentIds: string[];
}

export default function OrganizationPage() {
  const { agents, activeIds, toggleAgent, saveSquad, syncSquad } = useAgents();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [activities, setActivities] = useState<ActivityLogType[]>([]);
  const [workingAgentId, setWorkingAgentId] = useState<string | null>(null);

  const { status: wsStatus } = useWebSocket({
    onMessage: handleWsMessage,
  });

  const fetchTemplates = () =>
    fetch(`${API_CONFIG.BASE_URL}/templates`)
      .then((res) => res.json())
      .then(setTemplates);

  // Initial load
  useMemo(() => {
    fetchTemplates();
  }, []);

  function handleWsMessage(data: WsMessage) {
    if (['SQUAD_UPDATED', 'AGENT_HIRED', 'AGENT_FIRED'].includes(data.type)) {
      syncSquad();
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

  const applyTemplate = (template: Template) => saveSquad(template.activeAgentIds);

  const activeAgents = useMemo(() => agents.filter((agent) => activeIds.includes(agent.id)), [agents, activeIds]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">AGENCY</span>
            <span>HQ CONSOLE</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">指挥部</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            总览
          </Link>
          <Link href="/market" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            系统市场
          </Link>
          <div className="space-y-1">
            <Link href="/organization" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm">
              组织阵容
            </Link>
            <Link href="/employees" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium pl-10 text-slate-600 hover:bg-slate-50">
              员工列表
            </Link>
          </div>
          <Link href="/tasks" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            工作任务
          </Link>
          <Link href="/brainstorm" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            专家协作
          </Link>
          <Link href="/knowledge" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            知识资产
          </Link>
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-900">组织阵容</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">围绕阵容管理、模板复用与在岗状态的组织视图</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px]">
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
                      当前无在岗专家。请前往"系统市场"挑选并聘用。
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
          </div>
        </div>
      </main>
    </div>
  );
}
