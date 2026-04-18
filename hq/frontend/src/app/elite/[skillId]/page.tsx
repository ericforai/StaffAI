'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, FileText, Clock, Download, Sparkles } from 'lucide-react';
import { useEliteSkill } from '../../../hooks/useEliteSkills';

export default function SkillDetailPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const { skill, content, loading, error } = useEliteSkill(skillId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{error || '技能不存在'}</p>
          <Link href="/elite" className="text-purple-500 hover:underline mt-4 inline-block">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href="/elite"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回技能广场
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero */}
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-8 text-white">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                  🎯
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-2">{skill.name}</h1>
                  <p className="text-white/80">{skill.description}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">技能介绍</h2>
              <p className="text-gray-600 leading-relaxed">
                {skill.description}
              </p>
            </div>

            {/* Content Preview */}
            {content && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">技能内容</h2>
                  <button className="text-purple-500 hover:text-purple-600 flex items-center gap-1 text-sm">
                    <FileText className="w-4 h-4" />
                    查看完整内容
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                  {content.slice(0, 2000)}
                  {content.length > 2000 && '...'}
                </div>
              </div>
            )}

            {/* Expert Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">专家信息</h2>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center text-white text-xl">
                  {skill.expert.name[0]}
                </div>
                <div>
                  <div className="font-semibold">{skill.expert.name}</div>
                  <div className="text-sm text-gray-500">
                    {skill.expert.title} · {skill.expert.department}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                  🎯
                </div>
                <h3 className="font-semibold">{skill.name}</h3>
              </div>

              <Link
                href={`/elite/${skillId}/chat`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors mb-3"
              >
                <MessageCircle className="w-5 h-5" />
                咨询技能
              </Link>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">版本</span>
                  <span className="font-medium">v{skill.version || '1.0.0'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">分类</span>
                  <span className="font-medium">{skill.category}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">安装量</span>
                  <span className="font-medium">{skill.installCount} 人</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">更新时间</span>
                  <span className="font-medium">
                    {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
