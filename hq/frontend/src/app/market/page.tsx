'use client';

import { useState, useEffect } from 'react';
import { API_CONFIG } from '../utils/constants';

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

// =============================================================================
// Preset Searches
// =============================================================================

const PRESET_SEARCHES = [
  { key: 'agent-framework', label: 'Agent 框架', query: 'topic:agent-framework language:typescript' },
  { key: 'mcp', label: 'MCP 工具', query: 'topic:ai-agent topic:mcp' },
  { key: 'llm', label: 'LLM 助手', query: 'topic:llm-agent' },
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

function getRatingEmoji(rating: string): string {
  switch (rating) {
    case 'recommended': return '🟢';
    case 'consider': return '🟡';
    case 'not-recommended': return '🔴';
    default: return '⚪';
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

// =============================================================================
// Page Component
// =============================================================================

export default function MarketPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchUrl, setSearchUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch candidates on mount
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
      if (!response.ok) {
        throw new Error('获取候选列表失败');
      }

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
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">人才市场</h1>
        <p className="text-gray-600">从 GitHub 发现并评估外部 Agent 候选</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">候选总数</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-green-600">{stats.byRating.recommended}</div>
            <div className="text-sm text-gray-500">🟢 强烈推荐</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-yellow-600">{stats.byRating.consider}</div>
            <div className="text-sm text-gray-500">🟡 可以考虑</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-red-600">{stats.byRating['not-recommended']}</div>
            <div className="text-sm text-gray-500">🔴 不推荐</div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">发现候选</h2>

        {/* Preset Searches */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">预设搜索</label>
          <div className="flex gap-2">
            {PRESET_SEARCHES.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetSearch(preset)}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom URL */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">自定义 URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchUrl}
              onChange={(e) => setSearchUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCustomUrlSearch()}
            />
            <button
              onClick={handleCustomUrlSearch}
              disabled={loading || !searchUrl.trim()}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              搜索
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">关闭</button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded ${filterStatus === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          全部 ({stats?.total || 0})
        </button>
        <button
          onClick={() => setFilterStatus('candidate')}
          className={`px-3 py-1 rounded ${filterStatus === 'candidate' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          候选中 ({stats?.byStatus.candidate || 0})
        </button>
        <button
          onClick={() => setFilterStatus('observing')}
          className={`px-3 py-1 rounded ${filterStatus === 'observing' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          观察中 ({stats?.byStatus.observing || 0})
        </button>
        <button
          onClick={() => setFilterStatus('imported')}
          className={`px-3 py-1 rounded ${filterStatus === 'imported' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          已导入 ({stats?.byStatus.imported || 0})
        </button>
      </div>

      {/* Candidate List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无候选，请先搜索</div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    {candidate.evaluation && (
                      <span className="text-xl">{getRatingEmoji(candidate.evaluation.rating)}</span>
                    )}
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-semibold text-blue-600 hover:underline"
                    >
                      {candidate.owner}/{candidate.name}
                    </a>
                    <span className="text-gray-400">⭐ {candidate.score.stars || 0}</span>
                    <span className="text-gray-400">🍴 {candidate.score.forks || 0}</span>
                    {candidate.language && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {candidate.language}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {candidate.description && (
                    <p className="text-gray-700 text-sm mb-2">{candidate.description}</p>
                  )}

                  {/* Capability */}
                  {candidate.capability && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">分类：</span>
                      <span className="capitalize">{candidate.capability.category}</span>
                      {candidate.capability.specialties.length > 0 && (
                        <>
                          {' | '}
                          {candidate.capability.specialties.map((s) => s).join('、')}
                        </>
                      )}
                    </div>
                  )}

                  {/* Skills */}
                  {candidate.capability?.skills && candidate.capability.skills.length > 0 && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Skills：</span>
                      {candidate.capability.skills.join(', ')}
                    </div>
                  )}

                  {/* Evaluation */}
                  {candidate.evaluation && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">评级：</span>
                      {getRatingLabel(candidate.evaluation.rating)} ({candidate.evaluation.score}/100)
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="text-xs text-gray-400">
                    状态：{candidate.status === 'candidate' ? '候选中' :
                           candidate.status === 'observing' ? '观察中' :
                           candidate.status === 'imported' ? '已导入' : '已移除'}
                    {' • '}
                    更新于 {formatDate(candidate.updatedAt)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {candidate.status === 'candidate' || candidate.status === 'observing' ? (
                    <>
                      <button
                        onClick={() => handleImport(candidate.id)}
                        disabled={candidate.status === 'imported'}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300"
                      >
                        导入组织
                      </button>
                      <button
                        onClick={() => handleObserve(candidate.id)}
                        className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                      >
                        {candidate.status === 'observing' ? '保持观察' : '添加观察'}
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={() => handleRefresh(candidate.id)}
                    className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                  >
                    刷新
                  </button>
                  <button
                    onClick={() => handleRemove(candidate.id)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  >
                    移除
                  </button>
                </div>
              </div>

              {/* Strengths & Concerns */}
              {candidate.evaluation && (
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                  {candidate.evaluation.strengths.length > 0 && (
                    <div>
                      <div className="font-medium text-green-700 mb-1">优势：</div>
                      <ul className="text-gray-600 list-disc list-inside">
                        {candidate.evaluation.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {candidate.evaluation.concerns.length > 0 && (
                    <div>
                      <div className="font-medium text-red-700 mb-1">关注点：</div>
                      <ul className="text-gray-600 list-disc list-inside">
                        {candidate.evaluation.concerns.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
