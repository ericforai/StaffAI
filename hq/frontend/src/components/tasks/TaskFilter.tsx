'use client';

interface TaskFilterProps {
  viewMode: 'all' | 'active';
  setViewMode: (mode: 'all' | 'active') => void;
  visibleCount: number;
  totalCount: number;
}

export function TaskFilter({
  viewMode,
  setViewMode,
  visibleCount,
  totalCount
}: TaskFilterProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setViewMode('all')}
        className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
          viewMode === 'all'
            ? 'border-slate-400 bg-slate-100 text-slate-900'
            : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        全部任务
      </button>
      <button
        type="button"
        onClick={() => setViewMode('active')}
        className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
          viewMode === 'active'
            ? 'border-slate-400 bg-slate-100 text-slate-900'
            : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        待执行
      </button>
      <p className="text-xs text-slate-400">
        显示 {visibleCount} / {totalCount} 条任务
      </p>
    </div>
  );
}
