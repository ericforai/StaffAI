'use client';

import { useRef, useState, useCallback } from 'react';
import { AgentSelector } from './AgentSelector';
import { useTaskComposer } from '../../hooks/useTaskComposer';
import type { Agent, TaskSummary } from '../../types';

interface TaskComposerProps {
  agents: Agent[];
  activeIds: string[];
  onTaskCreated: (task: TaskSummary) => void;
  onSwitchToAdvanced: () => void;
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB'] as const;

function formatFileSize(bytes: number): string {
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif,.webp';

export function TaskComposer({ agents, activeIds, onTaskCreated, onSwitchToAdvanced }: TaskComposerProps) {
  const {
    title,
    setTitle,
    description,
    setDescription,
    assigneeId,
    setAssigneeId,
    assigneeName,
    setAssigneeName,
    priority,
    setPriority,
    submitting,
    error,
    uploadingFiles,
    addFiles,
    removeFile,
    createTask
  } = useTaskComposer(onTaskCreated);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    void addFiles(files);
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const isUploading = uploadingFiles.some((f) => f.progress === 'uploading');

  return (
    <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black tracking-[0.2em] text-slate-500">新建任务</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">发起新任务</h2>
        </div>
        <button
          type="button"
          onClick={onSwitchToAdvanced}
          className="relative z-[1] cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-100 transition-all flex items-center gap-2"
          aria-label="切换到 AI 需求向导"
        >
          <span aria-hidden>✨</span> 使用 AI 向导
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="任务标题"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="任务描述"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => void createTask()}
          disabled={submitting || isUploading || !assigneeId}
          className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {submitting ? '创建中...' : '创建任务'}
        </button>
      </div>

      {/* 负责人选择 - 部门-人员二级结构 */}
      <AgentSelector 
        agents={agents}
        activeIds={activeIds}
        selectedId={assigneeId}
        selectedName={assigneeName}
        onSelect={(id, name) => {
          setAssigneeId(id);
          setAssigneeName(name);
        }}
        error={!!error}
      />

      {/* 优先级选择 */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700 mb-2">
          优先级
        </label>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high' | 'urgent')}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none"
        >
          <option value="low">低优先级</option>
          <option value="medium">中优先级</option>
          <option value="high">高优先级</option>
          <option value="urgent">紧急</option>
        </select>
      </div>

      {/* 附件上传 */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700 mb-2">
          附件
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-all
            ${dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_TYPES}
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-1">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.57 5.595H6.75z" />
            </svg>
            <p className="text-xs text-slate-500">
              拖拽文件至此或 <span className="font-medium text-blue-600">点击上传</span>
            </p>
            <p className="text-[10px] text-slate-400">
              支持 PDF、Word、Excel、PPT、图片等，单文件最大 10MB
            </p>
          </div>
        </div>

        {/* 已上传文件列表 */}
        {uploadingFiles.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {uploadingFiles.map((entry, idx) => (
              <li
                key={`${entry.file.name}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
              >
                <FileIcon mimeType={entry.file.type} />
                <span className="flex-1 truncate text-slate-700">{entry.file.name}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatFileSize(entry.file.size)}</span>

                {entry.progress === 'uploading' && (
                  <span className="shrink-0 text-[11px] font-medium text-blue-500 animate-pulse">上传中...</span>
                )}
                {entry.progress === 'done' && (
                  <span className="shrink-0 text-[11px] font-medium text-emerald-600">✓</span>
                )}
                {entry.progress === 'error' && (
                  <span className="shrink-0 text-[11px] font-medium text-rose-500" title={entry.error}>失败</span>
                )}

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  aria-label={`删除 ${entry.file.name}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  let color = 'text-slate-400';
  if (mimeType.startsWith('image/')) color = 'text-purple-400';
  else if (mimeType.includes('pdf')) color = 'text-red-400';
  else if (mimeType.includes('word') || mimeType.includes('document')) color = 'text-blue-400';
  else if (mimeType.includes('sheet') || mimeType.includes('excel')) color = 'text-green-400';
  else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) color = 'text-orange-400';

  return (
    <svg className={`h-4 w-4 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
