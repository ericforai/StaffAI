'use client';

import { useState } from 'react';
import type { RequirementDraft, DesignSummary } from '@/types/domain';

interface Props {
  draft: RequirementDraft;
  onConfirm: (modifications?: Partial<DesignSummary>) => void;
  onBack?: () => void;
  loading: boolean;
}

export function DesignConfirmPanel({ draft, onConfirm, onBack, loading }: Props) {
  const [editing, setEditing] = useState(false);
  const [modifications, setModifications] = useState<Partial<DesignSummary>>({});
  const ds = draft.designSummary!;

  const fields: { key: keyof DesignSummary; label: string }[] = [
    { key: 'goal', label: '目标' },
    { key: 'targetUser', label: '目标用户' },
    { key: 'coreFlow', label: '核心流程' },
    { key: 'scope', label: '范围' },
    { key: 'outOfScope', label: '不在范围内' },
    { key: 'deliverables', label: '交付物' },
    { key: 'constraints', label: '约束条件' },
    { key: 'risks', label: '风险' },
  ];

  const getValue = (key: keyof DesignSummary) =>
    modifications[key] !== undefined ? modifications[key] : ds[key];

  const handleChange = (key: keyof DesignSummary, value: string) => {
    setModifications(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 space-y-4">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            {editing ? (
              <input
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                value={getValue(key)}
                onChange={(e) => handleChange(key, e.target.value)}
              />
            ) : (
              <p className="text-sm text-gray-300">{getValue(key) || '—'}</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {onBack && (
          <button
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
            onClick={onBack}
          >
            ← 上一步
          </button>
        )}
        <button
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
          onClick={() => setEditing(!editing)}
        >
          {editing ? '完成编辑' : '编辑'}
        </button>
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          onClick={() => onConfirm(editing ? modifications : undefined)}
          disabled={loading}
        >
          {loading ? '生成计划中...' : '确认并生成计划'}
        </button>
      </div>
    </div>
  );
}
