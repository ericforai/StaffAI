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

  const createTask = useCallback(async () => {
    if (!state.draft) return null;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/intents/${state.draft!.id}/create-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Task creation failed: ${res.status}`);
      const data = await res.json();
      return data.taskId;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
      return null;
    } finally {
      setState(s => ({ ...s, loading: false }));
    }
  }, [state.draft]);

  const loadIntent = useCallback(async (intentId: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/intents/${intentId}`);
      if (!res.ok) throw new Error(`Failed to load intent: ${res.status}`);
      const draft: RequirementDraft = await res.json();
      
      // Determine correct step based on status
      let step: 1 | 2 | 3 = 1;
      if (draft.status === 'plan_ready') step = 3;
      else if (draft.status === 'design_ready' || draft.status === 'design_approved') step = 2;

      setState({ draft, loading: false, error: null, step });
      return draft;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
      return null;
    }
  }, []);

  /**
   * SSE streaming version of sendMessage for real-time LLM responses
   */
  const sendMessageStream = useCallback(async (
    message: string,
    onChunk: (content: string, id: string) => void,
    onDone: (isComplete: boolean, draft?: RequirementDraft) => void,
    onError: (error: string) => void
  ) => {
    if (!state.draft) return;
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/intents/${state.draft!.id}/clarify/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) throw new Error(`Stream failed: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentMsgId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (!data.trim()) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === 'user_message') {
                // User message was saved, update local state
                continue;
              }

              if (event.type === 'done') {
                // Stream complete
                setState(s => ({
                  ...s,
                  loading: false,
                  draft: event.draft || s.draft,
                  step: event.isComplete ? 2 : 1
                }));
                onDone(event.isComplete, event.draft);
                return;
              }

              if (event.type === 'error') {
                throw new Error(event.error);
              }

              // Content chunk
              if (event.content !== undefined) {
                if (!currentMsgId && event.id) {
                  currentMsgId = event.id;
                }
                onChunk(event.content, currentMsgId || '');
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Stream ended without explicit done
      setState(s => ({ ...s, loading: false }));
      onDone(false);
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
      onError(String(err));
    }
  }, [state.draft]);

  return { state, createIntent, sendMessage, sendMessageStream, confirmDesign, createTask, loadIntent };
}
