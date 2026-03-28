'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, BookOpenText } from 'lucide-react';
import { useGlobalWebSocket } from '../../hooks/useGlobalWebSocket';
import { API_CONFIG } from '../../utils/constants';

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

interface RawKnowledgeEntry {
  excerpt?: string;
  relativePath: string;
  modifiedAtMs: number;
  type: string;
}

export default function KnowledgePage() {
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeSourceFilter, setKnowledgeSourceFilter] = useState<'all' | KnowledgeSource>('all');
  const [knowledgeAgentFilter, setKnowledgeAgentFilter] = useState<'all' | string>('all');
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null);

  const { status: wsStatus } = useGlobalWebSocket({ onMessage: () => {} });

  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}/memory/retrieve?q=*&limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.entries)) {
          const entries: KnowledgeEntry[] = data.entries.map((entry: RawKnowledgeEntry) => {
            let cleanContent = entry.excerpt || '';
            if (cleanContent.includes('---')) {
              cleanContent = cleanContent.split('---').pop()?.trim() || cleanContent;
            }
            if (cleanContent.includes('Result Summary:')) {
              cleanContent = cleanContent.split('Result Summary:').pop()?.trim() || cleanContent;
            }

            return {
              id: entry.relativePath,
              signature: entry.relativePath + entry.modifiedAtMs,
              source: entry.type === 'knowledge' ? 'report' : 'discussion',
              title: entry.relativePath.split('/').pop()?.replace('.md', '').replace(/^2026-\d{2}-\d{2}-(success|failure)-/, '').toUpperCase() || '未命名存档',
              task: entry.type === 'task' ? '任务执行总结' : '专家研究成果',
              summary: cleanContent.slice(0, 200),
              content: cleanContent,
              createdAt: new Date(entry.modifiedAtMs).toISOString(),
              tags: [entry.type],
            };
          });

          setKnowledgeEntries(entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      })
      .catch(err => console.error('Failed to load knowledge:', err));
  }, []);

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
          <Link href="/brainstorm" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            专家协作
          </Link>
          <Link href="/knowledge" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-slate-900 text-white shadow-sm">
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
            <h2 className="text-sm font-bold text-slate-900">知识资产</h2>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs text-slate-500">围绕历史结论、专家归档与检索回看的知识台</p>
          </div>

          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">知识库</p>
              <p className="text-sm font-bold text-slate-900 leading-none mt-1">{knowledgeEntries.length}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mx-auto w-full max-w-[1800px] space-y-5">
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
                      <p className="text-xs font-bold uppercase tracking-widest">选择条目查看详情</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
