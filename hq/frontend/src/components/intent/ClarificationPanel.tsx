'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { RequirementDraft } from '@/types/domain';

interface Props {
  draft: RequirementDraft;
  onSendMessage: (message: string) => void;
  onSendMessageStream?: (
    message: string,
    onChunk: (content: string, id: string) => void,
    onDone: (isComplete: boolean, draft?: RequirementDraft) => void,
    onError: (error: string) => void
  ) => void;
  /** Fires when user sends a message (for retry / recovery). */
  onMessageSent?: (message: string) => void;
  loading: boolean;
}

export function ClarificationPanel({
  draft,
  onSendMessage,
  onSendMessageStream,
  onMessageSent,
  loading,
}: Props) {
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStreaming = streamingContent !== '' && loading;

  useEffect(() => {
    // Auto-follow only if the user hasn't scrolled up to read older messages.
    if (!autoScrollEnabled || !isNearBottom) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [draft.clarificationMessages, streamingContent]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      // "Near bottom" heuristic prevents scroll-jank during streaming.
      const thresholdPx = 80;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = distanceFromBottom <= thresholdPx;
      setIsNearBottom(near);
      if (near) setAutoScrollEnabled(true);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      el.removeEventListener('scroll', update);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    setAutoScrollEnabled(true);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  const handleChunk = useCallback((content: string, id: string) => {
    setStreamingMsgId(id);
    setStreamingContent(prev => prev + content);
  }, []);

  const handleDone = useCallback((isComplete: boolean, updatedDraft?: RequirementDraft) => {
    setStreamingContent('');
    setStreamingMsgId(null);
    // Trigger parent update if needed
    if (isComplete && updatedDraft) {
      // The parent hook will handle updating the draft state
    }
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('[ClarificationPanel] Stream error:', error);
    setStreamingContent('');
    setStreamingMsgId(null);
  }, []);

  const handleSend = () => {
    if (!input.trim() || loading) return;

    const message = input.trim();
    setInput('');
    onMessageSent?.(message);

    // Use streaming if available
    if (onSendMessageStream) {
      onSendMessageStream(message, handleChunk, handleDone, handleError);
    } else {
      onSendMessage(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Panel */}
      <div className="lg:col-span-2 bg-gray-900 rounded-lg border border-gray-700 flex flex-col h-[600px]">
        <div className="relative flex-1 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {draft.clarificationMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200 border border-gray-600'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="bg-gray-800 text-gray-200 rounded-lg px-4 py-2 border border-gray-600 max-w-[80%]">
                <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                <span className="inline-block animate-pulse ml-1">▊</span>
              </div>
            </div>
          )}

          {/* Loading indicator without content */}
          {loading && !streamingContent && (
            <div className="flex justify-start">
              <div className="bg-gray-800 text-gray-400 rounded-lg px-4 py-2 border border-gray-600">
                <p className="text-sm animate-pulse">思考中...</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>

          {/* Jump-to-bottom affordance when user scrolls up */}
          {!isNearBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-3 right-3 rounded-full bg-gray-800/90 text-gray-200 border border-gray-600 px-3 py-1.5 text-xs hover:bg-gray-700"
            >
              回到底部
            </button>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="请输入你的回答..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">需求摘要</h3>
        <div className="space-y-3">
          <SummaryField label="目标" value={draft.designSummary?.goal} />
          <SummaryField label="目标用户" value={draft.designSummary?.targetUser} />
          <SummaryField label="核心流程" value={draft.designSummary?.coreFlow} />
          <SummaryField label="交付物" value={draft.designSummary?.deliverables} />
          <SummaryField label="约束" value={draft.designSummary?.constraints} />
          <SummaryField label="范围" value={draft.designSummary?.scope} />
          <SummaryField label="不在范围内" value={draft.designSummary?.outOfScope} />
          <SummaryField label="风险" value={draft.designSummary?.risks} />
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex justify-between text-xs text-gray-500">
            <span>置信度</span>
            <span>{Math.round(draft.confidenceScore * 100)}%</span>
          </div>
          <div className="mt-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${draft.confidenceScore * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
