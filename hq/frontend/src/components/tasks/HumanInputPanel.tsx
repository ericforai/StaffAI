'use client';

import { useState } from 'react';
import { MessageSquare, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { PendingHumanInput } from '../../types/hitl-types';
import { formatTimestamp } from '../../utils/dateFormatter';

interface HumanInputPanelProps {
  inputs: PendingHumanInput[];
  onRespond: (assignmentId: string, answer: string, answeredBy?: string) => Promise<void>;
  submitting?: boolean;
  submitError?: string | null;
}

function PendingInputCard({
  input,
  onSubmit,
  submitting,
  error,
}: {
  input: PendingHumanInput;
  onSubmit: (answer: string) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [answer, setAnswer] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    await onSubmit(answer.trim());
    setAnswer('');
  }

  return (
    <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50/80 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-200 p-2">
          <MessageSquare className="h-4 w-4 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black tracking-[0.16em] text-amber-600 uppercase">
              等待人工输入
            </p>
            <span className="text-[10px] text-slate-400">
              {formatTimestamp(input.createdAt)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
            {input.questions}
          </p>
        </div>
      </div>

      {input.status === 'pending' && (
        <form onSubmit={handleSubmit} className="mt-4">
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 resize-none"
            rows={4}
            placeholder="在此输入您的回答..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitting}
          />
          {error && (
            <div className="mt-2 flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-4 w-4" />
              <p className="text-xs">{error}</p>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={!answer.trim() || submitting}
              className="flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  提交回答
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AnsweredInputCard({ input }: { input: PendingHumanInput }) {
  return (
    <div className="rounded-[1.1rem] border border-slate-200 bg-white/60 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-emerald-100 p-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black tracking-[0.16em] text-emerald-600 uppercase">
              已回答
            </p>
            <span className="text-[10px] text-slate-400">
              {input.answeredAt ? formatTimestamp(input.answeredAt) : ''}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 italic">
            {input.answer}
          </p>
          {input.answeredBy && (
            <p className="mt-1 text-[10px] text-slate-400">
              — {input.answeredBy}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function HumanInputPanel({
  inputs,
  onRespond,
  submitting = false,
  submitError = null,
}: HumanInputPanelProps) {
  const pending = inputs.filter((i) => i.status === 'pending');
  const answered = inputs.filter((i) => i.status === 'answered' || i.status === 'cancelled');

  if (inputs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {pending.map((input) => (
        <PendingInputCard
          key={input.id}
          input={input}
          onSubmit={(answer) => onRespond(input.assignmentId, answer)}
          submitting={submitting}
          error={submitError}
        />
      ))}
      {answered.map((input) => (
        <AnsweredInputCard key={input.id} input={input} />
      ))}
    </div>
  );
}
