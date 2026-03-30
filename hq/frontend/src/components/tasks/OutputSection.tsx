'use client';

import { useState } from 'react';
import { LucideIcon, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface OutputSectionProps {
  title: string;
  icon: LucideIcon;
  content: string;
  level: 'good' | 'warning' | 'error';
}

/**
 * Render a single section with appropriate styling
 * 可折叠的章节卡片，根据级别显示不同颜色
 */
export function OutputSection({ title, icon: Icon, content, level }: OutputSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const levelStyles = {
    error: 'bg-rose-50 border-rose-300 text-rose-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    good: 'bg-white border-slate-200 text-slate-800',
  };

  const iconBgStyles = {
    error: 'bg-rose-100 text-rose-600',
    warning: 'bg-amber-100 text-amber-600',
    good: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className={`rounded-xl border ${levelStyles[level]} mb-3 overflow-hidden shadow-sm`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-black/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${iconBgStyles[level]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 opacity-50" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-50" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-black/10 bg-white/50 p-4">
          <div className="prose prose-slate prose-sm max-w-3xl text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // 表格样式优化
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full divide-y divide-slate-200 border border-slate-300 rounded-lg overflow-hidden">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-50">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-slate-50">{children}</tr>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-normal">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-sm text-slate-600 whitespace-normal align-top">
                    {children}
                  </td>
                ),
                // 代码块样式
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <code className={`${className} rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800`} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-800" {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="my-3 rounded-lg bg-slate-900 p-4 overflow-x-auto">
                    <code className="text-xs font-mono text-slate-100 whitespace-pre-wrap">{children}</code>
                  </pre>
                ),
                // 段落和列表样式 - normal 会折叠多余空白
                p: ({ children }) => (
                  <p className="my-3 leading-7 whitespace-normal">{children}</p>
                ),
                li: ({ children }) => (
                  <li className="my-1 leading-7 whitespace-normal">{children}</li>
                ),
                // 标题样式
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
