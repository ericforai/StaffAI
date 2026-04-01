'use client';

import { LucideIcon, FileText, Code, ShieldCheck, ClipboardCheck, Layout, Terminal } from 'lucide-react';

interface Artifact {
  id: string;
  type: 'prd' | 'architecture' | 'frontend_spec' | 'backend_spec' | 'security_report' | 'review_report' | 'generic';
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

interface Assignment {
  id: string;
  agentId: string;
  assignmentRole?: string;
  artifacts?: Artifact[];
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  prd: FileText,
  architecture: Layout,
  frontend_spec: Code,
  backend_spec: Terminal,
  security_report: ShieldCheck,
  review_report: ClipboardCheck,
  generic: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  prd: '需求文档',
  architecture: '架构设计',
  frontend_spec: '前端规范',
  backend_spec: '后端规范',
  security_report: '安全报告',
  review_report: '评审报告',
  generic: '通用产物',
};

export function ArtifactsPanel({ assignments }: { assignments: Assignment[] }) {
  const allArtifacts = assignments.flatMap(asgn => 
    (asgn.artifacts || []).map(art => ({ ...art, agentId: asgn.agentId }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (allArtifacts.length === 0) {
    return (
      <div className="rounded-[2.5rem] border border-slate-200 bg-white/50 p-12 text-center backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <FileText size={32} />
        </div>
        <h3 className="mt-6 text-xl font-black text-slate-900">暂无中间产物</h3>
        <p className="mt-2 text-slate-500">团队正在努力推进中，产出后将在此展示。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {allArtifacts.map((artifact) => {
        const Icon = TYPE_ICONS[artifact.type] || TYPE_ICONS.generic;
        return (
          <div key={artifact.id} className="group overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/50">
                  <Icon size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900">{artifact.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{TYPE_LABELS[artifact.type]}</span>
                    <span>•</span>
                    <span>{artifact.agentId}</span>
                  </div>
                </div>
              </div>
              <time className="text-[10px] font-bold text-slate-400">
                {new Date(artifact.createdAt).toLocaleString()}
              </time>
            </div>
            <div className="p-8">
              <div className="prose prose-slate prose-sm max-w-none prose-headings:font-black prose-a:text-sky-600">
                {/* 简单的 Markdown 模拟展示，实际可使用 react-markdown */}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-600">
                  {artifact.content}
                </pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
