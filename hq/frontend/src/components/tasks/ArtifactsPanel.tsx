'use client';

import { useState } from 'react';
import {
  LucideIcon,
  FileText,
  Code,
  ShieldCheck,
  ClipboardCheck,
  Layout,
  Terminal,
  Copy,
  Download,
  Files,
} from 'lucide-react';

function slugifyFilename(title: string): string {
  const s = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
  return (s.length > 0 ? s : 'artifact').slice(0, 80);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadMarkdownFile(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [copyFlashId, setCopyFlashId] = useState<string | null>(null);

  const allArtifacts = assignments.flatMap(asgn => 
    (asgn.artifacts || []).map(art => ({ ...art, agentId: asgn.agentId }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (allArtifacts.length === 0) {
    return (
      <div
        data-testid="delivery-artifacts-panel"
        className="rounded-[2.5rem] border border-slate-200 bg-white/50 p-12 text-center backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <FileText size={32} />
        </div>
        <h3 className="mt-6 text-xl font-black text-slate-900">暂无中间产物</h3>
        <p className="mt-2 text-slate-500">团队正在努力推进中，产出后将在此展示。</p>
      </div>
    );
  }

  const exportAllMarkdown = () => {
    const blocks = allArtifacts.map((a) => {
      const label = TYPE_LABELS[a.type] ?? a.type;
      return `# ${a.title}\n\n_类型：${label} · ${a.agentId} · ${a.createdAt}_\n\n${a.content}`;
    });
    const combined = blocks.join('\n\n---\n\n');
    downloadMarkdownFile(`artifacts-bundle-${Date.now()}.md`, combined);
  };

  return (
    <div data-testid="delivery-artifacts-panel" className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          data-testid="artifact-export-all-md"
          onClick={exportAllMarkdown}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Files size={14} aria-hidden />
          合并导出 Markdown
        </button>
      </div>
      {allArtifacts.map((artifact) => {
        const Icon = TYPE_ICONS[artifact.type] || TYPE_ICONS.generic;
        const mdBody = `# ${artifact.title}\n\n${artifact.content}`;
        const baseName = slugifyFilename(artifact.title);
        return (
          <div key={artifact.id} className="group overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-8 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/50">
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-slate-900">{artifact.title}</h4>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{TYPE_LABELS[artifact.type]}</span>
                    <span>•</span>
                    <span>{artifact.agentId}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid={`artifact-copy-${artifact.id}`}
                  onClick={() => {
                    void (async () => {
                      const ok = await copyTextToClipboard(artifact.content);
                      if (ok) {
                        setCopyFlashId(artifact.id);
                        window.setTimeout(() => setCopyFlashId((id) => (id === artifact.id ? null : id)), 2000);
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                >
                  <Copy size={12} aria-hidden />
                  {copyFlashId === artifact.id ? '已复制' : '复制全文'}
                </button>
                <button
                  type="button"
                  data-testid={`artifact-export-${artifact.id}`}
                  onClick={() => downloadMarkdownFile(`${baseName}-${artifact.id.slice(0, 8)}.md`, mdBody)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                >
                  <Download size={12} aria-hidden />
                  导出 Markdown
                </button>
                <time className="text-[10px] font-bold text-slate-400">
                  {new Date(artifact.createdAt).toLocaleString()}
                </time>
              </div>
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
