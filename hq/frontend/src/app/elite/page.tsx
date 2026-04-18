'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Settings, Sparkles } from 'lucide-react';
import { useEliteSkills } from '../../hooks/useEliteSkills';
import type { EliteSkill } from '../../lib/api-client';

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'sales', label: '销售' },
  { key: 'marketing', label: '营销' },
  { key: 'engineering', label: '工程' },
  { key: 'design', label: '设计' },
  { key: 'product', label: '产品' },
  { key: 'support', label: '客服' },
];

const CATEGORY_COLORS: Record<string, string> = {
  sales: 'from-blue-500 to-blue-600',
  marketing: 'from-pink-500 to-rose-500',
  engineering: 'from-cyan-500 to-teal-500',
  design: 'from-purple-500 to-violet-500',
  product: 'from-amber-500 to-orange-500',
  support: 'from-emerald-500 to-green-500',
};

function SkillCard({ skill }: { skill: EliteSkill }) {
  const colorClass = CATEGORY_COLORS[skill.category] || 'from-gray-500 to-gray-600';

  return (
    <Link href={`/elite/${skill.id}`} className="block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
        <div className={`h-32 bg-gradient-to-br ${colorClass} relative`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">🎯</span>
            </div>
          </div>
          <div className="absolute bottom-3 left-4 text-white/80 text-sm">
            {skill.expert.name} · {skill.expert.department}
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
            {skill.name}
          </h3>
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {skill.description}
          </p>
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              skill.status === 'published'
                ? 'bg-emerald-50 text-emerald-600'
                : skill.status === 'pending'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-gray-50 text-gray-500'
            }`}>
              {skill.status === 'published' ? '已发布' : skill.status === 'pending' ? '待审核' : '已下架'}
            </span>
            <span className="text-xs text-gray-400">
              v{skill.version || '1.0.0'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ElitePage() {
  const { skills, loading, error } = useEliteSkills();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(search.toLowerCase()) ||
      skill.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || skill.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                精英克隆
              </h1>
              <p className="text-gray-500 mt-1">
                浏览公司专家沉淀的 Skills，AI 咨询即刻上手
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/elite/admin"
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                管理
              </Link>
              <Link
                href="/elite/admin"
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                上传技能
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索技能..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  category === cat.key
                    ? 'bg-purple-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Skills Grid */}
        {!loading && !error && (
          <>
            {filteredSkills.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无技能</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredSkills.map(skill => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
