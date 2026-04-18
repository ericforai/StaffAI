'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Check, X, ArrowDown, ArrowUp, Upload, Globe, Loader2, ExternalLink, FileText, Tag, User, Folder, Clipboard, Github, Download, Edit, Copy } from 'lucide-react';
import { useEliteSkills } from '../../../hooks/useEliteSkills';
import { createEliteSkill, importEliteSkillFromUrl, searchEliteSkills, updateEliteSkill, getEliteSkillContent } from '../../../lib/api-client';
import type { EliteSkill } from '../../../lib/api-client';

type TabType = 'all' | 'pending' | 'published' | 'deprecated';
type ImportMode = 'search' | 'paste';

// 上传技能表单类型
interface SkillFormData {
  name: string;
  description: string;
  version: string;
  expertName: string;
  expertDepartment: string;
  expertTitle: string;
  category: string;
  tags: string;
  content: string;
}

const CATEGORIES = ['sales', 'marketing', 'engineering', 'design', 'product', 'support', 'management', 'other'];

const DEFAULT_FORM: SkillFormData = {
  name: '',
  description: '',
  version: '1.0.0',
  expertName: '',
  expertDepartment: '',
  expertTitle: '',
  category: 'other',
  tags: '',
  content: '',
};

// 联网搜索结果类型
interface SearchResult {
  name: string;
  description: string;
  url: string;
  stars: number;
  author: string;
}

export default function AdminPage() {
  const { skills, loading, error, publishSkill, deprecateSkill, deleteSkill, fetchSkills, cloneSkill } = useEliteSkills({ includeAll: true });
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');

  // 上传技能弹窗状态
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [formData, setFormData] = useState<SkillFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  // 联网搜索弹窗状态
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // 克隆操作反馈状态
  const [cloneSuccessMsg, setCloneSuccessMsg] = useState('');
  const [cloneErrorMsg, setCloneErrorMsg] = useState('');

  // 编辑技能弹窗状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<EliteSkill | null>(null);
  const [editFormData, setEditFormData] = useState<SkillFormData>(DEFAULT_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const filteredSkills = skills.filter(skill => {
    const matchesTab = tab === 'all' || skill.status === tab;
    const matchesSearch = skill.name.toLowerCase().includes(search.toLowerCase()) ||
      skill.expert.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: EliteSkill['status']) => {
    switch (status) {
      case 'published':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">已发布</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">待审核</span>;
      case 'deprecated':
        return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">已下架</span>;
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishSkill(id);
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  };

  const handleDeprecate = async (id: string) => {
    try {
      await deprecateSkill(id);
    } catch (err) {
      console.error('Failed to deprecate:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个技能吗？')) return;
    try {
      await deleteSkill(id);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleClone = async (id: string) => {
    setCloneErrorMsg('');
    setCloneSuccessMsg('');
    try {
      const cloned = await cloneSkill(id);
      setCloneSuccessMsg(`克隆成功！已将「${cloned.name}」添加到技能库`);
      await fetchSkills();
      // 3秒后自动清除提示
      setTimeout(() => setCloneSuccessMsg(''), 3000);
    } catch (err) {
      setCloneErrorMsg(err instanceof Error ? err.message : '克隆失败');
      setTimeout(() => setCloneErrorMsg(''), 3000);
    }
  };

  // 打开编辑弹窗
  const handleEdit = async (skill: EliteSkill) => {
    setEditingSkill(skill);
    setEditError('');
    setEditSuccess('');
    setIsEditing(true);

    try {
      const content = await getEliteSkillContent(skill.id);
      setEditFormData({
        name: skill.name,
        description: skill.description,
        version: skill.version || '1.0.0',
        expertName: skill.expert.name,
        expertDepartment: skill.expert.department,
        expertTitle: skill.expert.title,
        category: skill.category,
        tags: skill.tags?.join(', ') || '',
        content: content,
      });
      setShowEditModal(true);
    } catch (err) {
      setEditError('加载技能内容失败');
    } finally {
      setIsEditing(false);
    }
  };

  // 保存编辑
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;

    setEditError('');
    setEditSuccess('');

    if (!editFormData.name || !editFormData.description || !editFormData.expertName || !editFormData.content) {
      setEditError('请填写必填项：技能名称、描述、专家姓名和技能内容');
      return;
    }

    setIsEditing(true);
    try {
      await updateEliteSkill(editingSkill.id, {
        name: editFormData.name,
        description: editFormData.description,
        version: editFormData.version || '1.0.0',
        expert: {
          name: editFormData.expertName,
          department: editFormData.expertDepartment || '未知部门',
          title: editFormData.expertTitle || '专家',
        },
        category: editFormData.category,
        tags: editFormData.tags.split(',').map(t => t.trim()).filter(Boolean),
        content: editFormData.content,
      });
      setEditSuccess('技能更新成功！');
      await fetchSkills();
      setTimeout(() => {
        setShowEditModal(false);
        setEditingSkill(null);
      }, 1500);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setIsEditing(false);
    }
  };

  // 处理上传技能表单提交
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!formData.name || !formData.description || !formData.expertName || !formData.content) {
      setSubmitError('请填写必填项：技能名称、描述、专家姓名和技能内容');
      return;
    }

    setIsSubmitting(true);
    try {
      await createEliteSkill({
        name: formData.name,
        description: formData.description,
        version: formData.version || '1.0.0',
        expert: {
          name: formData.expertName,
          department: formData.expertDepartment || '未知部门',
          title: formData.expertTitle || '专家',
        },
        category: formData.category,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        content: formData.content,
      });
      setSubmitSuccess('技能上传成功！');
      setFormData(DEFAULT_FORM);
      setShowUploadModal(false);
      await fetchSkills();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理联网搜索（通过后端代理避免 CORS）
  const handleWebSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const data = await searchEliteSkills(searchQuery);
      setSearchResults(data.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setIsSearching(false);
    }
  };

  // 从 URL 导入技能内容（通过后端代理避免 CORS）
  const handleImportFromUrl = async (url: string) => {
    try {
      const data = await importEliteSkillFromUrl(url);

      setFormData({
        ...DEFAULT_FORM,
        name: data.name || '导入技能',
        description: data.description || '从 GitHub 导入',
        content: data.content,
        category: 'other',
      });

      setShowSearchModal(false);
      setShowUploadModal(true);
    } catch (err) {
      setSearchError('导入失败，请检查 URL 是否正确');
    }
  };

  // 直接通过 GitHub URL 导入
  const handleDirectImport = async () => {
    if (!directUrl.trim()) {
      setSearchError('请输入 GitHub 仓库地址');
      return;
    }

    setIsImporting(true);
    setSearchError('');

    try {
      const data = await importEliteSkillFromUrl(directUrl);

      setFormData({
        ...DEFAULT_FORM,
        name: data.name || '导入技能',
        description: data.description || '从 GitHub 导入',
        content: data.content,
        category: 'other',
      });

      setShowSearchModal(false);
      setShowUploadModal(true);
      setDirectUrl('');
    } catch (err) {
      setSearchError('导入失败，请检查 URL 是否正确');
    } finally {
      setIsImporting(false);
    }
  };

  // 处理直接粘贴 SKILL.md 内容
  const handlePasteContent = () => {
    if (!pastedContent.trim()) {
      setSearchError('请粘贴 SKILL.md 内容');
      return;
    }

    // 解析 frontmatter
    const frontmatterMatch = pastedContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    let name = '粘贴技能';
    let description = '直接粘贴导入';
    let content = pastedContent;

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const body = frontmatterMatch[2];
      const nameMatch = frontmatter.match(/name:\s*"?([^"\n]+)"?/);
      const descMatch = frontmatter.match(/description:\s*"?([^"\n]+)"?/);
      name = nameMatch?.[1] || name;
      description = descMatch?.[1] || description;
      content = body.trim();
    }

    setFormData({
      ...DEFAULT_FORM,
      name,
      description,
      content,
      category: 'other',
    });

    setShowSearchModal(false);
    setShowUploadModal(true);
    setPastedContent('');
  };

  const counts = {
    all: skills.length,
    pending: skills.filter(s => s.status === 'pending').length,
    published: skills.filter(s => s.status === 'published').length,
    deprecated: skills.filter(s => s.status === 'deprecated').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                精英克隆 · 管理面板
              </h1>
              <p className="text-gray-500 mt-1">管理公司技能库</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/elite"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                返回技能广场
              </Link>
              <button
                onClick={() => setShowSearchModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Globe className="w-4 h-4" />
                联网搜索
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                上传技能
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {([
              { key: 'all', label: '全部', count: counts.all },
              { key: 'pending', label: '待审核', count: counts.pending },
              { key: 'published', label: '已发布', count: counts.published },
              { key: 'deprecated', label: '已下架', count: counts.deprecated },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 克隆操作反馈 */}
        {cloneSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            {cloneSuccessMsg}
          </div>
        )}
        {cloneErrorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            {cloneErrorMsg}
          </div>
        )}
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索技能或专家..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">加载中...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">技能</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">专家</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">分类</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">更新时间</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      暂无技能
                    </td>
                  </tr>
                ) : (
                  filteredSkills.map(skill => (
                    <tr key={skill.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{skill.name}</div>
                        <div className="text-sm text-gray-500">v{skill.version || '1.0.0'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">{skill.expert.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {skill.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(skill.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {skill.status === 'pending' && (
                            <button
                              onClick={() => handlePublish(skill.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="发布"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {skill.status === 'published' && (
                            <button
                              onClick={() => handleDeprecate(skill.id)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="下架"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          )}
                          {skill.status === 'deprecated' && (
                            <button
                              onClick={() => handlePublish(skill.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="重新发布"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(skill)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleClone(skill.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="克隆"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(skill.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 上传技能弹窗 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-500" />
                上传技能
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="skill-form" onSubmit={handleUploadSubmit} className="space-y-4">
                {/* 技能名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    技能名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：顾问式销售技能体系"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* 技能描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    技能描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="简要描述这个技能的核心价值..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                {/* 版本号 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Tag className="w-4 h-4 inline mr-1" />
                      版本号
                    </label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      placeholder="1.0.0"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Folder className="w-4 h-4 inline mr-1" />
                      分类
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 专家信息 */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    专家信息
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">姓名 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.expertName}
                        onChange={(e) => setFormData({ ...formData, expertName: e.target.value })}
                        placeholder="专家姓名"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">部门</label>
                      <input
                        type="text"
                        value={formData.expertDepartment}
                        onChange={(e) => setFormData({ ...formData, expertDepartment: e.target.value })}
                        placeholder="所在部门"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">职位</label>
                      <input
                        type="text"
                        value={formData.expertTitle}
                        onChange={(e) => setFormData({ ...formData, expertTitle: e.target.value })}
                        placeholder="职位名称"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 标签 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标签（用逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="例如：销售, 电子签章, 顾问式销售"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* 技能内容 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FileText className="w-4 h-4 inline mr-1" />
                    SKILL.md 内容 <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">粘贴技能的全部内容（支持 Markdown 格式）</p>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={`# 技能标题

## 专家简介
简要介绍专家背景...

## 技能内容
详细的技能说明...

## 使用场景
何时使用这个技能...

## 注意事项
使用时的关键注意点...`}
                    rows={12}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-none"
                  />
                </div>

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {submitError}
                  </div>
                )}

                {submitSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-sm">
                    {submitSuccess}
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                form="skill-form"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? '上传中...' : '确认上传'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 联网搜索弹窗 */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-500" />
                联网搜索
              </h2>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 导入模式切换 */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setImportMode('search')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                  importMode === 'search'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Github className="w-4 h-4" />
                GitHub 搜索
              </button>
              <button
                onClick={() => setImportMode('paste')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                  importMode === 'paste'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clipboard className="w-4 h-4" />
                直接粘贴
              </button>
            </div>

            {/* 搜索模式 */}
            {importMode === 'search' && (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
                      placeholder="搜索公开的 SKILL.md 文件..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleWebSearch}
                      disabled={isSearching}
                      className="flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          搜索中...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          搜索
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    通过 GitHub 搜索公开的 SKILL.md 文件，找到后可一键导入到技能库
                  </p>
                </div>

                {/* 直接 URL 导入 */}
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-3">或直接输入 GitHub 仓库地址导入</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDirectImport()}
                      placeholder="https://github.com/username/repo"
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleDirectImport}
                      disabled={isImporting || !directUrl.trim()}
                      className="flex items-center gap-2 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          导入中...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          直接导入
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 粘贴模式 */}
            {importMode === 'paste' && (
              <div className="p-6 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  直接粘贴 SKILL.md 文件的完整内容，系统会自动解析 frontmatter 信息
                </p>
                <textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder={`---
name: 技能名称
description: 技能描述
---

# 技能标题

技能内容...`}
                  rows={12}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-none"
                />
                <button
                  onClick={handlePasteContent}
                  disabled={!pastedContent.trim()}
                  className="mt-3 flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  导入内容
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {searchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                  {searchError}
                </div>
              )}

              {isSearching && (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" />
                  <p className="text-gray-500">正在搜索...</p>
                </div>
              )}

              {!isSearching && searchResults.length === 0 && !searchError && importMode === 'search' && (
                <div className="text-center py-12">
                  <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">输入关键词搜索公开技能</p>
                  <p className="text-xs text-gray-400 mt-1">例如：sales, marketing, engineering</p>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{result.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{result.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span>作者：{result.author}</span>
                            <span>⭐ {result.stars}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleImportFromUrl(result.url)}
                            className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                          >
                            导入
                          </button>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑技能弹窗 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Edit className="w-5 h-5 text-purple-500" />
                编辑技能
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSkill(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-form" onSubmit={handleEditSubmit} className="space-y-4">
                {/* 技能名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    技能名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="例如：顾问式销售技能体系"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* 技能描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    技能描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="简要描述这个技能的核心价值..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                {/* 版本号 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Tag className="w-4 h-4 inline mr-1" />
                      版本号
                    </label>
                    <input
                      type="text"
                      value={editFormData.version}
                      onChange={(e) => setEditFormData({ ...editFormData, version: e.target.value })}
                      placeholder="1.0.0"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Folder className="w-4 h-4 inline mr-1" />
                      分类
                    </label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 专家信息 */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    专家信息
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">姓名 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={editFormData.expertName}
                        onChange={(e) => setEditFormData({ ...editFormData, expertName: e.target.value })}
                        placeholder="专家姓名"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">部门</label>
                      <input
                        type="text"
                        value={editFormData.expertDepartment}
                        onChange={(e) => setEditFormData({ ...editFormData, expertDepartment: e.target.value })}
                        placeholder="所在部门"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">职位</label>
                      <input
                        type="text"
                        value={editFormData.expertTitle}
                        onChange={(e) => setEditFormData({ ...editFormData, expertTitle: e.target.value })}
                        placeholder="职位名称"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 标签 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标签（用逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={editFormData.tags}
                    onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                    placeholder="例如：销售, 电子签章, 顾问式销售"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* 技能内容 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FileText className="w-4 h-4 inline mr-1" />
                    SKILL.md 内容 <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">粘贴技能的全部内容（支持 Markdown 格式）</p>
                  <textarea
                    value={editFormData.content}
                    onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                    rows={12}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-none"
                  />
                </div>

                {editError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {editError}
                  </div>
                )}

                {editSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-sm">
                    {editSuccess}
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSkill(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                form="edit-form"
                disabled={isEditing}
                className="flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {isEditing && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
