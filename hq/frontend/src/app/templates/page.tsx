'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, Play, Users, Layout } from 'lucide-react';

interface Template {
  name: string;
  type: string;
  activeAgentIds: string[];
  description?: string;
  createdAt?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/templates`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setTemplates(data);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to fetch templates:', err);
        setError(err.message || '无法加载模板库，请检查后端服务是否启动。');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleUseTemplate = async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(name)}/create-task`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        alert('任务创建成功！正在为您跳转...');
        router.push('/tasks');
      } else {
        alert('创建失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      alert('调用出错: ' + String(err));
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除模板 "${name}" 吗？`)) return;
    try {
      const res = await fetch(`${API_BASE}/templates/${name}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(templates.filter(t => t.name !== name));
      }
    } catch (err) {
      alert('删除失败: ' + String(err));
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1e7]">
      <div className="text-center font-black text-slate-400 animate-pulse">正在加载模板库...</div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1e7]">
      <div className="rounded-3xl bg-white p-12 text-center shadow-xl ring-1 ring-slate-200">
        <p className="text-lg font-bold text-rose-500">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 rounded-2xl bg-slate-900 px-8 py-3 text-sm font-black text-white transition-transform active:scale-95"
        >
          重试
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f6f1e7] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black tracking-[0.2em] text-slate-500 uppercase">Knowledge Assets</p>
            <h1 className="mt-2 text-4xl font-black text-slate-950">模板中心</h1>
          </div>
          <Link href="/tasks?mode=advanced" className="rounded-full bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95">
            从新需求开始
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.name} className="group relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/50">
                <Layout size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900">{template.name}</h3>
              {template.scenario && (
                <div className="mt-1 flex">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600 ring-1 ring-blue-200/50">
                    {template.scenario}
                  </span>
                </div>
              )}
              <p className="mt-3 line-clamp-2 text-sm text-slate-500 leading-relaxed">
                {template.description || '暂无描述。'}
              </p>
              
              <div className="mt-6 flex items-center gap-4 border-t border-slate-100 pt-6">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">{template.activeAgentIds.length} 位专家</span>
                </div>
                {template.createdAt && (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="absolute right-6 top-6 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button 
                  onClick={() => handleDelete(template.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button 
                onClick={() => handleUseTemplate(template.name)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 py-3 text-sm font-black text-slate-900 transition-colors hover:bg-slate-100"
              >
                <Play size={16} />
                使用此模板
              </button>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="rounded-[3rem] border-2 border-dashed border-slate-200 p-20 text-center">
            <p className="text-lg font-bold text-slate-400">模板库空空如也</p>
            <p className="mt-2 text-slate-500">完成任务后点击“保存为模板”，让经验在此沉淀。</p>
          </div>
        )}
      </div>
    </main>
  );
}
