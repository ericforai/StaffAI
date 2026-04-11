'use client';

import { useState, useCallback } from 'react';
import type { RequirementDraft, DesignSummary } from '../types/domain';
import { getApiBaseUrl } from '../utils/constants';

interface IntentWizardState {
  draft: RequirementDraft | null;
  loading: boolean;
  error: string | null;
  step: 1 | 2 | 3;
}

function isLikelyNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const s = String(err);
  return /fetch failed|Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(s);
}

function formatIntentApiError(err: unknown, apiBase: string): string {
  if (isLikelyNetworkFailure(err)) {
    return `无法连接后端 API（${apiBase}）。请确认 hq 后端已启动，且 NEXT_PUBLIC_BACKEND_PORT / NEXT_PUBLIC_API_URL 与后端一致。`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function postClarifyNonStream(
  api: string,
  draftId: string,
  message: string
): Promise<{ draft: RequirementDraft; isComplete: boolean }> {
  const res = await fetch(`${api}/intents/${draftId}/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Clarification failed: ${res.status}`);
  return res.json() as Promise<{ draft: RequirementDraft; isComplete: boolean }>;
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
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
        cache: 'no-store',
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
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/intents/${state.draft!.id}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        cache: 'no-store',
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
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/intents/${state.draft!.id}/confirm-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modifications }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Design confirmation failed: ${res.status}`);
      const confirmedDraft: RequirementDraft = await res.json();

      const planRes = await fetch(`${api}/intents/${confirmedDraft.id}/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
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
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/intents/${state.draft!.id}/create-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
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
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/intents/${intentId}`, { cache: 'no-store' });
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

    const api = getApiBaseUrl();
    const draftId = state.draft.id;

    let response: Response;
    try {
      response = await fetch(`${api}/intents/${draftId}/clarify/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message }),
        cache: 'no-store',
      });
    } catch (fetchErr) {
      if (isLikelyNetworkFailure(fetchErr)) {
        try {
          const data = await postClarifyNonStream(api, draftId, message);
          const step = data.isComplete ? 2 : 1;
          setState({ draft: data.draft, loading: false, error: null, step });
          onDone(data.isComplete, data.draft);
          return;
        } catch (fallbackErr) {
          const msg = formatIntentApiError(fallbackErr, api);
          setState(s => ({ ...s, loading: false, error: msg }));
          onError(msg);
          return;
        }
      }
      const msg = formatIntentApiError(fetchErr, api);
      setState(s => ({ ...s, loading: false, error: msg }));
      onError(msg);
      return;
    }

    try {
      if (!response.ok) throw new Error(`Stream failed: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentMsgId: string | null = null;

      const handleParsedEvent = (event: {
        type?: string;
        isComplete?: boolean;
        draft?: RequirementDraft;
        error?: string;
        content?: string;
        id?: string;
      }): boolean => {
        if (event.type === 'user_message') {
          return false;
        }
        if (event.type === 'done') {
          setState((s) => ({
            ...s,
            loading: false,
            draft: event.draft || s.draft,
            step: event.isComplete ? 2 : 1,
          }));
          onDone(!!event.isComplete, event.draft);
          return true;
        }
        if (event.type === 'error') {
          throw new Error(event.error || 'Stream error');
        }
        if (event.content !== undefined) {
          if (!currentMsgId && event.id) {
            currentMsgId = event.id;
          }
          onChunk(event.content, currentMsgId || '');
        }
        return false;
      };

      const processLine = (line: string): boolean => {
        if (!line.startsWith('data: ')) return false;
        const data = line.slice(6).trim();
        if (!data) return false;
        let event: {
          type?: string;
          isComplete?: boolean;
          draft?: RequirementDraft;
          error?: string;
          content?: string;
          id?: string;
        };
        try {
          event = JSON.parse(data) as typeof event;
        } catch {
          return false;
        }
        return handleParsedEvent(event);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode(new Uint8Array(), { stream: false });
          for (const line of buffer.split('\n')) {
            if (processLine(line)) return;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (processLine(line)) return;
        }
      }

      // Stream ended without a terminal `done` frame (should be rare after backend fix)
      setState((s) => ({ ...s, loading: false }));
      onDone(false);
    } catch (err) {
      const msg = formatIntentApiError(err, api);
      setState(s => ({ ...s, loading: false, error: msg }));
      onError(msg);
    }
  }, [state.draft]);

  return { state, createIntent, sendMessage, sendMessageStream, confirmDesign, createTask, loadIntent };
}
