'use client';

import { useState, useEffect } from 'react';
import { Search, Users, TrendingUp, Clipboard, RefreshCw, Download, Eye, Trash2, ExternalLink } from 'lucide-react';
import { API_CONFIG } from '../../utils/constants';
import DashboardLayout from '../../components/DashboardLayout';

// =============================================================================
// Types
// =============================================================================

interface Candidate {
  id: string;
  source: 'github' | 'npm' | 'pypi' | 'custom';
  url: string;
  owner: string;
  name: string;
  description?: string;
  language?: string;
  score: {
    stars?: number;
    forks?: number;
    lastUpdated: string;
  };
  topics: string[];
  evaluation?: {
    score: number;
    rating: 'recommended' | 'consider' | 'not-recommended';
    tier: 'excellent' | 'good' | 'fair' | 'poor';
    strengths: string[];
    concerns: string[];
    evaluatedAt: string;
  };
  capability?: {
    category: string;
    specialties: string[];
    description: string;
    skills: string[];
  };
  status: 'candidate' | 'observing' | 'imported' | 'removed';
  createdAt: string;
  updatedAt: string;
}

interface MarketStats {
  total: number;
  byStatus: {
    candidate: number;
    observing: number;
    imported: number;
    removed: number;
  };
  byRating: {
    recommended: number;
    consider: number;
    'not-recommended': number;
  };
  avgScore: number;
}

const PRESET_SEARCHES = [
  { key: 'agent-framework', label: 'Agent 框架', query: 'topic:agent-framework language:typescript' },
  { key: 'mcp', label: 'MCP 工具', query: 'topic:ai-agent topic:mcp' },
  { key: 'llm', label: 'LLM 助手', query: 'topic:llm-agent' },
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

function getRatingColor(rating: string): string {
  switch (rating) {
    case 'recommended': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'consider': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'not-recommended': return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getRatingLabel(rating: string): string {
  switch (rating) {
    case 'recommended': return '强烈推荐';
    case 'consider': return '可以考虑';
    case 'not-recommended': return '不推荐';
    default: return '未评估';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'candidate': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'observing': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'imported': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'removed': return 'bg-gray-50 text-gray-500 border-gray-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'candidate': return '候选中';
    case 'observing': return '观察中';
    case 'imported': return '已导入';
    case 'removed': return '已移除';
    default: return status;
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// =============================================================================
// Market Page Component
// =============================================================================

export default function MarketPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchUrl, setSearchUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchCandidates();
    fetchStats();
  }, [filterStatus]);

  async function fetchCandidates() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/market/candidates?${params}`);
      if (!response.ok) throw new Error('获取候选列表失败');

      const data = await response.json();
      setCandidates(data.candidates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取候选列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/market/stats`);
      if (!response.ok) return;
      const data = await response.json();
      setStats(data);
    } catch {
      // Ignore stats errors
    }
  }

  async function handlePresetSearch(preset: typeof PRESET_SEARCHES[number]) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_CONFIG.BASE_URL}/market/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: preset.key }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '搜索失败');
      }

      await fetchCandidates();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCustomUrlSearch() {
    if (!searchUrl.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_CONFIG.BASE_URL}/market/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: searchUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '搜索失败');
      }

      setSearchUrl('');
      await fetchCandidates();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(candidateId: string) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/market/candidates/${candidateId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '导入失败');
      }

      await fetchCandidates();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    }
  }

  async function handleObserve(candidateId: string) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/market/candidates/${candidateId}/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '操作失败');
      }

      await fetchCandidates();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  }

  async function handleRemove(candidateId: string) {
    if (!confirm('确定要移除这个候选吗？')) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/market/candidates/${candidateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '移除失败');
      }

      await fetchCandidates();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '移除失败');
    }
  }

  async function handleRefresh(candidateId: string) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/market/candidates/${candidateId}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '刷新失败');
      }

      await fetchCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                  <div className="text-sm text-slate-500">候选总数</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{stats.byRating.recommended}</div>
                  <div className="text-sm text-slate-500">强烈推荐</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{stats.byRating.consider}</div>
                  <div className="text-sm text-slate-500">可以考虑</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                  <Clipboard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-rose-600">{stats.byRating['not-recommended']}</div>
                  <div className="text-sm text-slate-500">不推荐</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" />
            发现候选
          </h2>

          <div className="mb-5">
            <label className="text-sm font-medium text-slate-700 mb-2 block">预设搜索</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_SEARCHES.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetSearch(preset)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer text-sm font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">自定义 URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchUrl}
                onChange={(e) => setSearchUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors duration-200 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCustomUrlSearch()}
              />
              <button
                onClick={handleCustomUrlSearch}
                disabled={loading || !searchUrl.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer text-sm font-medium"
              >
                <Search className="w-4 h-4" />
                搜索
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-rose-600 hover:text-rose-800 transition-colors duration-200 cursor-pointer text-sm underline"
            >
              关闭
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm">
          {[
            { key: 'all', label: '全部', count: stats?.total || 0 },
            { key: 'candidate', label: '候选中', count: stats?.byStatus.candidate || 0 },
            { key: 'observing', label: '观察中', count: stats?.byStatus.observing || 0 },
            { key: 'imported', label: '已导入', count: stats?.byStatus.imported || 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer text-sm ${
                filterStatus === tab.key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Candidate List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-violet-600 mb-4"></div>
            <p className="text-slate-500">加载中...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
            <div className="inline-block p-4 bg-slate-100 rounded-full mb-4">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500">暂无候选，请先搜索</p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-200"
              >
                <div className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {candidate.evaluation && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRatingColor(candidate.evaluation.rating)}`}>
                            {getRatingLabel(candidate.evaluation.rating)}
                          </span>
                        )}
                        <a
                          href={candidate.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base font-semibold text-violet-600 hover:text-violet-800 transition-colors duration-200"
                        >
                          {candidate.owner}/{candidate.name}
                          <ExternalLink className="w-3 h-3 inline ml-1" />
                        </a>
                        <span className="text-sm text-slate-500">
                          ⭐ {formatNumber(candidate.score.stars || 0)}
                        </span>
                        <span className="text-sm text-slate-500">
                          🍴 {formatNumber(candidate.score.forks || 0)}
                        </span>
                        {candidate.language && (
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded">
                            {candidate.language}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(candidate.status)}`}>
                          {getStatusLabel(candidate.status)}
                        </span>
                      </div>

                      {candidate.description && (
                        <p className="text-slate-700 text-sm mb-2">{candidate.description}</p>
                      )}

                      {candidate.capability && (
                        <div className="text-sm text-slate-600 mb-2">
                          <span className="font-medium">分类：</span>
                          <span className="capitalize">{candidate.capability.category}</span>
                          {candidate.capability.specialties.length > 0 && (
                            <> • {candidate.capability.specialties.join('、')}</>
                          )}
                        </div>
                      )}

                      {candidate.capability?.skills && candidate.capability.skills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 mb-2">
                          <span className="font-medium">Skills：</span>
                          {candidate.capability.skills.slice(0, 5).map((skill, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded"
                            >
                              {skill}
                            </span>
                          ))}
                          {candidate.capability.skills.length > 5 && (
                            <span className="text-xs text-slate-400">+{candidate.capability.skills.length - 5}</span>
                          )}
                        </div>
                      )}

                      {candidate.evaluation && (
                        <div className="text-sm text-slate-600 mb-1">
                          <span className="font-medium">评分：</span>
                          <span className={`font-semibold ${
                            candidate.evaluation.score >= 80 ? 'text-emerald-600' :
                            candidate.evaluation.score >= 60 ? 'text-amber-600' :
                            'text-rose-600'
                          }`}>
                            {candidate.evaluation.score}/100
                          </span>
                        </div>
                      )}

                      <div className="text-xs text-slate-400">
                        更新于 {formatDate(candidate.updatedAt)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {candidate.status === 'candidate' || candidate.status === 'observing' ? (
                        <>
                          <button
                            onClick={() => handleImport(candidate.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors duration-200 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            导入
                          </button>
                          <button
                            onClick={() => handleObserve(candidate.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors duration-200 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {candidate.status === 'observing' ? '观察中' : '观察'}
                          </button>
                        </>
                      ) : null}
                      <button
                        onClick={() => handleRefresh(candidate.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors duration-200 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        刷新
                      </button>
                      <button
                        onClick={() => handleRemove(candidate.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-200 transition-colors duration-200 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        移除
                      </button>
                    </div>
                  </div>

                  {candidate.evaluation && (candidate.evaluation.strengths.length > 0 || candidate.evaluation.concerns.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {candidate.evaluation.strengths.length > 0 && (
                        <div className="bg-emerald-50 rounded-lg p-2.5">
                          <div className="font-medium text-emerald-700 mb-1.5 text-xs">优势</div>
                          <ul className="text-slate-700 space-y-0.5 text-xs">
                            {candidate.evaluation.strengths.slice(0, 3).map((s, i) => (
                              <li key={i}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {candidate.evaluation.concerns.length > 0 && (
                        <div className="bg-rose-50 rounded-lg p-2.5">
                          <div className="font-medium text-rose-700 mb-1.5 text-xs">关注点</div>
                          <ul className="text-slate-700 space-y-0.5 text-xs">
                            {candidate.evaluation.concerns.slice(0, 3).map((c, i) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
