'use client';

import { useState } from 'react';
import type { RequirementDraft, DesignSummary } from '@/types/domain';

interface Props {
  draft: RequirementDraft;
  onConfirm: (modifications?: Partial<DesignSummary>) => void;
  loading: boolean;
}

export function DesignConfirmPanel({ draft, onConfirm, loading }: Props) {
  const [editing, setEditing] = useState(false);
  const [modifications, setModifications] = useState<Partial<DesignSummary>>({});
  const ds = draft.designSummary!;

  const fields: { key: keyof DesignSummary; label: string }[] = [
    { key: 'goal', label: 'Goal' },
    { key: 'targetUser', label: 'Target User' },
    { key: 'coreFlow', label: 'Core Flow' },
    { key: 'scope', label: 'Scope' },
    { key: 'outOfScope', label: 'Out of Scope' },
    { key: 'deliverables', label: 'Deliverables' },
    { key: 'constraints', label: 'Constraints' },
    { key: 'risks', label: 'Risks' },
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
        <button
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Done Editing' : 'Edit'}
        </button>
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          onClick={() => onConfirm(editing ? modifications : undefined)}
          disabled={loading}
        >
          {loading ? 'Generating Plan...' : 'Confirm & Generate Plan'}
        </button>
      </div>
    </div>
  );
}
