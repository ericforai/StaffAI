'use client';

import { useState } from 'react';
import { useIntentWizard } from '@/hooks/useIntentWizard';
import { ClarificationPanel } from '@/components/intent/ClarificationPanel';
import { DesignConfirmPanel } from '@/components/intent/DesignConfirmPanel';
import { PlanPreviewPanel } from '@/components/intent/PlanPreviewPanel';

export default function NewTaskWizard() {
  const wizard = useIntentWizard();
  const { state } = wizard;

  // Step 1: Input + Clarification
  if (state.step === 1 && !state.draft) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">New Task</h1>
          <p className="text-gray-400 mb-8">Describe what you want to build in one sentence.</p>
          <RawInputForm onSubmit={wizard.createIntent} loading={state.loading} />
        </div>
      </div>
    );
  }

  // Step 1b: Clarification dialogue
  if (state.step === 1 && state.draft) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Clarifying Your Requirement</h1>
          <ClarificationPanel
            draft={state.draft}
            onSendMessage={wizard.sendMessage}
            loading={state.loading}
          />
        </div>
      </div>
    );
  }

  // Step 2: Design Confirmation
  if (state.step === 2 && state.draft?.designSummary) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Confirm Design</h1>
          <DesignConfirmPanel
            draft={state.draft}
            onConfirm={wizard.confirmDesign}
            loading={state.loading}
          />
        </div>
      </div>
    );
  }

  // Step 3: Plan Preview
  if (state.step === 3 && state.draft?.implementationPlan) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Implementation Plan</h1>
          <PlanPreviewPanel draft={state.draft} />
        </div>
      </div>
    );
  }

  return null;
}

function RawInputForm({ onSubmit, loading }: { onSubmit: (input: string) => void; loading: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div className="space-y-4">
      <textarea
        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        placeholder="e.g., I want to add a task creation wizard with autonomy levels and plan preview..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      <button
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={loading || !value.trim()}
      >
        {loading ? 'Starting...' : 'Start Clarification'}
      </button>
    </div>
  );
}
