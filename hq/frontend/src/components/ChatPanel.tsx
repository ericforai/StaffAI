/**
 * 聊天面板组件
 */
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Command } from 'lucide-react';
import { Message } from '../hooks/useChat';
import { Agent } from '../types';
import { splitTextWithMentions, isMention } from '../lib/messageParser';

export interface ChatPanelProps {
  messages: Message[];
  chatInput: string;
  setChatInput: (value: string) => void;
  onSendMessage: () => void;
  activeAgents: Agent[];
  onAddMention: (name: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatPanel({
  messages,
  chatInput,
  setChatInput,
  onSendMessage,
  activeAgents,
  onAddMention,
  messagesEndRef
}: ChatPanelProps) {
  return (
    <section className="h-[25vh] flex flex-col bg-white/[0.02] border-t border-white/10 z-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-cyan-500/[0.01] pointer-events-none" />

      <div className="px-10 py-3 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md">
        <h2 className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase flex items-center gap-2">
          <MessageSquare className="w-3 h-3 text-cyan-500" /> MISSION CONTROL
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {activeAgents.slice(0, 8).map(a => (
              <motion.button
                whileHover={{ y: -3, zIndex: 50, scale: 1.1 }}
                key={a.id}
                className="w-7 h-7 rounded-full bg-slate-800 border-2 border-[#0a0c10] flex items-center justify-center text-sm shadow-xl cursor-pointer transition-all"
                onClick={() => onAddMention(a.frontmatter.name)}
                title={`@${a.frontmatter.name}`}
              >
                {a.frontmatter.emoji || '🤖'}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-4 space-y-3 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {messages.map(m => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={m.id}
              className="flex gap-6 group hover:bg-white/[0.02] -mx-4 px-4 py-2 rounded-2xl transition-all"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-2xl shadow-lg self-start mt-1">
                {m.senderEmoji || '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-white text-sm tracking-tight uppercase">{m.sender}</span>
                  <span className="text-[10px] text-slate-600 font-mono font-bold tracking-widest">
                    {m.timestamp.toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
                <p className="text-lg text-slate-300 leading-relaxed break-words font-medium">
                  {splitTextWithMentions(m.text).map((part, i) =>
                    isMention(part) ? (
                      <span key={i} className="text-cyan-400 font-black bg-cyan-400/10 px-1.5 py-0.5 rounded transition-colors">
                        {part}
                      </span>
                    ) : (
                      part
                    )
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="p-10 pt-0">
        <div className="relative group max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-cyan-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity rounded-3xl" />
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-500">
            <Command className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="输入指令，使用 @ 提及专家协作..."
            className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl pl-16 pr-20 py-5 text-xl text-white outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSendMessage()}
          />
          <button
            onClick={onSendMessage}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-cyan-500 text-black rounded-2xl hover:bg-cyan-400 transition-all hover:scale-110 shadow-2xl active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed"
            disabled={!chatInput.trim()}
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>
  );
}
