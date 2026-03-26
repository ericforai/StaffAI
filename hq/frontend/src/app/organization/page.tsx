'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Users, Activity, Palette, Megaphone, Building2, ChevronDown, Cpu, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { useAgents } from '../../hooks/useAgents';
import { ActivityLog, type ActivityLog as ActivityLogType } from '../../components/ActivityLog';
import { useWebSocket, type WsMessage } from '../../hooks/useWebSocket';
import { API_CONFIG, DEPT_MAP } from '../../utils/constants';

interface ProjectTeam {
  name: string;
  description?: string;
  activeAgentIds: string[];
  createdAt?: string;
}

// 部门分组配置 - 模拟真实科层结构
const DEPT_GROUPS = {
  '技术中心': {
    icon: Cpu,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    departments: ['engineering', 'game-development', 'testing', 'spatial-computing'],
  },
  '产品中心': {
    icon: Palette,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    departments: ['product', 'design'],
  },
  '营销中心': {
    icon: Megaphone,
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    departments: ['marketing', 'paid-media'],
  },
  '运营中心': {
    icon: Activity,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    departments: ['project-management', 'support'],
  },
  '专家组': {
    icon: Users,
    color: 'from-slate-500 to-gray-500',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    departments: ['specialized'],
  },
} as const;

export default function OrganizationPage() {
  const { agents, activeIds, toggleAgent, saveSquad, syncSquad } = useAgents();
  const [projectTeams, setProjectTeams] = useState<ProjectTeam[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [activities, setActivities] = useState<ActivityLogType[]>([]);
  const [workingAgentId, setWorkingAgentId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<ProjectTeam | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['技术中心', '产品中心']));
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // 只显示已入职的员工（在岗员工）
  const hiredAgents = useMemo(() => agents.filter((agent) => activeIds.includes(agent.id)), [agents, activeIds]);

  const { status: wsStatus } = useWebSocket({
    onMessage: handleWsMessage,
  });

  const fetchProjectTeams = () =>
    fetch(`${API_CONFIG.BASE_URL}/templates`)
      .then((res) => res.json())
      .then((data) => setProjectTeams(data || []));

  useMemo(() => {
    fetchProjectTeams();
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

  const handleCreateTeam = async () => {
    if (!newTeamName) return;

    await fetch(`${API_CONFIG.BASE_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTeamName,
        description: newTeamDesc,
        activeAgentIds: activeIds,
        createdAt: new Date().toISOString()
      }),
    });

    setNewTeamName('');
    setNewTeamDesc('');
    setShowCreateTeam(false);
    fetchProjectTeams();
  };

  const handleActivateTeam = (team: ProjectTeam) => {
    setSelectedTeam(team);
    saveSquad(team.activeAgentIds);
  };

  const handleDeleteTeam = async (teamName: string) => {
    await fetch(`${API_CONFIG.BASE_URL}/templates/${encodeURIComponent(teamName)}`, {
      method: 'DELETE',
    });
    fetchProjectTeams();
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const toggleDept = (deptKey: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptKey)) {
        next.delete(deptKey);
      } else {
        next.add(deptKey);
      }
      return next;
    });
  };

  const activeAgents = useMemo(() => agents.filter((agent) => activeIds.includes(agent.id)), [agents, activeIds]);

  // 统计信息 - 只统计已入职员工
  const stats = useMemo(() => {
    const groupStats: any = {};
    const deptStats: any = {};

    for (const agent of hiredAgents) {
      // 部门统计
      const dept = agent.department;
      if (!deptStats[dept]) {
        deptStats[dept] = { total: 0, active: 0 };
      }
      deptStats[dept].total++;

      // 分组统计
      Object.entries(DEPT_GROUPS).forEach(([groupName, groupConfig]: any) => {
        if (groupConfig.departments.includes(dept)) {
          if (!groupStats[groupName]) {
            groupStats[groupName] = { total: 0, active: 0 };
          }
          groupStats[groupName].total++;
        }
      });
    }

    return { groupStats, deptStats };
  }, [hiredAgents]);

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
          <Link href="/organization" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm">
            组织架构
          </Link>
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
            <Building2 className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">组织架构</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">科层结构视图 · 部门层级关系</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">在岗</p>
              <p className="text-sm font-bold text-slate-900 leading-none mt-1">{activeIds.length}</p>
            </div>
            {activeIds.length > 0 && (
              <button
                onClick={() => setShowCreateTeam(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:border-slate-400 hover:text-slate-900"
              >
                <Plus className="h-3.5 w-3.5" />
                保存为项目组
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px]">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* 左侧：组织架构树 */}
              <div className="lg:col-span-2 space-y-4">
                {/* 中心分组 */}
                {Object.entries(DEPT_GROUPS).map(([groupName, groupConfig]) => {
                  const Icon = groupConfig.icon;
                  const groupStat = stats.groupStats[groupName] || { total: 0, active: 0 };
                  const isExpanded = expandedGroups.has(groupName);

                  return (
                    <div key={groupName} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg bg-gradient-to-br ${groupConfig.color} p-2 text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-bold text-slate-900">{groupName}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {groupConfig.departments.map(d => DEPT_MAP[d]?.label).join(' · ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">人员</p>
                            <p className="text-sm font-bold text-slate-900 leading-none mt-1">
                              {groupStat.total}
                            </p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                        </div>
                      </button>

                      {/* 展开的部门列表 */}
                      {isExpanded && (
                        <div className="border-t border-slate-100">
                          {groupConfig.departments.map((deptKey) => {
                            const deptConfig = DEPT_MAP[deptKey];
                            if (!deptConfig) return null;

                            const DeptIcon = deptConfig.icon;
                            const deptStat = stats.deptStats[deptKey] || { total: 0, active: 0 };
                            const deptAgents = hiredAgents.filter((agent) => agent.department === deptKey);
                            const isDeptExpanded = expandedDepts.has(deptKey);

                            return (
                              <div key={deptKey} className="border-b border-slate-100 last:border-b-0">
                                <button
                                  onClick={() => toggleDept(deptKey)}
                                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ml-4"
                                >
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isDeptExpanded ? '' : '-rotate-90'}`} />
                                    <DeptIcon className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-700">{deptConfig.label}</span>
                                    <span className="text-[10px] text-slate-400">({deptStat.total})</span>
                                  </div>
                                </button>

                                {/* 展开的人员列表 */}
                                {isDeptExpanded && (
                                  <div className="px-4 py-2 space-y-1 ml-8">
                                    {deptAgents.map((agent) => {
                                      const isWorking = workingAgentId === agent.id;
                                      return (
                                        <button
                                          key={agent.id}
                                          onClick={() => setSelectedAgent(agent)}
                                          className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all bg-slate-50 text-slate-600 hover:bg-slate-100"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className={`h-2 w-2 rounded-full bg-emerald-400 ${isWorking ? 'animate-pulse' : ''}`} />
                                            <span className="text-xs font-medium">{agent.frontmatter.name}</span>
                                          </div>
                                          <span className="text-[10px] uppercase tracking-tight opacity-60">
                                            {agent.id}
                                          </span>
                                        </button>
                                      );
                                    })}
                                    {deptAgents.length === 0 && (
                                      <div className="text-center py-3 text-xs text-slate-400">
                                        暂无人员
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 右侧：详情面板 */}
              <div className="space-y-4">
                {/* 当前选中专家 */}
                {selectedAgent ? (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-900">专家详情</h3>
                      <button
                        onClick={() => setSelectedAgent(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        ×
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">姓名</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{selectedAgent.frontmatter.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">部门</p>
                        <p className="text-sm text-slate-700 mt-1">{DEPT_MAP[selectedAgent.department]?.label}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">描述</p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedAgent.frontmatter.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          toggleAgent(selectedAgent.id);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-slate-400 hover:text-slate-900"
                      >
                        解聘（移出组织）
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                    <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-500">选择专家查看详情</p>
                    <p className="text-xs text-slate-400 mt-1">点击左侧人员列表</p>
                  </div>
                )}

                {/* 项目组 */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-slate-600" />
                      <h3 className="text-sm font-bold text-slate-900">项目组</h3>
                    </div>
                    <button
                      onClick={() => setShowCreateTeam(true)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-100"
                    >
                      <Plus className="h-3 w-3" />
                      新建
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {projectTeams.map((team) => (
                      <div
                        key={team.name}
                        className={`group rounded-lg border px-3 py-2 transition-all ${
                          selectedTeam?.name === team.name
                            ? 'border-sky-300 bg-sky-50'
                            : 'border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => handleActivateTeam(team)}
                            className="flex-1 text-left"
                          >
                            <p className="text-xs font-semibold text-slate-700 truncate">{team.name}</p>
                            {team.description && (
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">{team.description}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">{team.activeAgentIds.length} 成员</p>
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.name)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {projectTeams.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400">
                        <FolderKanban className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                        <p>暂无项目组</p>
                        <p className="text-[10px] mt-1">为不同任务创建团队</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* 底部：活动日志 */}
              <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">系统活动流</h3>
                </div>
                <div className="p-0 max-h-48">
                  <ActivityLog activities={activities} wsStatus={wsStatus} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 创建项目组 Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateTeam(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-slate-600" />
                <h3 className="text-base font-bold text-slate-900">创建项目组</h3>
              </div>
              <button
                onClick={() => setShowCreateTeam(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">项目组名称</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="例如：官网重构组"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">描述（可选）</label>
                <textarea
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="例如：负责官网技术架构重构和前端开发"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 resize-none"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <span>当前成员数</span>
                <span className="font-bold text-slate-700">{activeIds.length} 人</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowCreateTeam(false);
                    setNewTeamName('');
                    setNewTeamDesc('');
                  }}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={!newTeamName}
                  className="flex-1 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
