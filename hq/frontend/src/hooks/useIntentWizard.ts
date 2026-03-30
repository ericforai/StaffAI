'use client';

import { useState, useCallback } from 'react';
import type { RequirementDraft, DesignSummary } from '../types/domain';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

interface IntentWizardState {
  draft: RequirementDraft | null;
  loading: boolean;
  error: string | null;
  step: 1 | 2 | 3;
}

export function useIntentWizard() {
  const [state, setState] = useState<IntentWizardState>({
    draft: null,
    loading: false,
    error: null,
    step: 1,
  });

  const createIntent = useCallback(async (rawInput: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      });
      if (!res.ok) throw new Error(`Failed to create intent: ${res.status}`);
      const draft: RequirementDraft = await res.json();
      setState({ draft, loading: false, error: null, step: 1 });
      return draft;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!state.draft) return null;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/intents/${state.draft!.id}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`Clarification failed: ${res.status}`);
      const data = await res.json();
      const updatedDraft: RequirementDraft = data.draft;
      const step = data.isComplete ? 2 : 1;
      setState({ draft: updatedDraft, loading: false, error: null, step });
      return data;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
      return null;
    }
  }, [state.draft]);

  const confirmDesign = useCallback(async (modifications?: Partial<DesignSummary>) => {
    if (!state.draft) return null;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/intents/${state.draft!.id}/confirm-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modifications }),
      });
      if (!res.ok) throw new Error(`Design confirmation failed: ${res.status}`);
      const confirmedDraft: RequirementDraft = await res.json();

      const planRes = await fetch(`${API_BASE}/intents/${confirmedDraft.id}/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!planRes.ok) throw new Error(`Plan generation failed: ${planRes.status}`);
      const planDraft: RequirementDraft = await planRes.json();
      setState({ draft: planDraft, loading: false, error: null, step: 3 });
      return planDraft;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
      return null;
    }
  }, [state.draft]);

  return { state, createIntent, sendMessage, confirmDesign };
}
