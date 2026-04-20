'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Send, Sparkles, Lightbulb } from 'lucide-react';
import { useEliteSkill } from '../../../../hooks/useEliteSkills';
import { consultEliteSkill } from '../../../../lib/api-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const RECOMMENDED_QUESTIONS = [
  '这个技能适合在什么场景使用？',
  '如何使用这个技能提升工作效率？',
  '有哪些注意事项需要了解？',
];

// 去掉 Markdown 格式符号，保留纯文本
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '') // 去掉 # 标题
    .replace(/\*\*(.+?)\*\*/g, '$1') // 去掉 **粗体**
    .replace(/\*(.+?)\*/g, '$1') // 去掉 *斜体*
    .replace(/`(.+?)`/g, '$1') // 去掉 `代码`
    .replace(/```[\s\S]*?```/g, '') // 去掉 代码块
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 去掉 链接
    .replace(/^\s*[-*+]\s+/gm, '') // 去掉 列表符号
    .replace(/^\s*\d+\.\s+/gm, '') // 去掉 数字列表
    .replace(/^\s*>\s+/gm, '') // 去掉 引用
    .replace(/\|/g, ' ') // 去掉 表格竖线
    .replace(/\n{3,}/g, '\n\n') // 压缩多余换行
    .trim();
}

function getSkillIdParam(skillId: string | string[] | undefined) {
  if (Array.isArray(skillId)) {
    return skillId[0] || '';
  }

  return skillId || '';
}

export default function ChatPage() {
  const params = useParams<{ skillId: string | string[] }>();
  const skillId = getSkillIdParam(params.skillId);
  const { skill, loading } = useEliteSkill(skillId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await consultEliteSkill(skillId, text.trim());
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，AI 服务暂时繁忙，请稍后重试。如果问题持续存在，请联系管理员检查 AI 服务配置。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">技能不存在</p>
          <Link href="/elite" className="text-purple-500 hover:underline mt-4 inline-block">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link
            href={`/elite/${skillId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold">{skill.name}</h1>
              <p className="text-sm text-gray-500">AI 咨询助手 · 基于 {skill.expert.name} 经验</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-32 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">开始咨询</h2>
                <p className="text-gray-500 mb-6">
                  基于「{skill.name}」的内容，AI 将为你解答相关问题
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {RECOMMENDED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-purple-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gradient-to-br from-purple-500 to-violet-600 text-white'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white shadow-sm'
                }`}>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white">
                  🤖
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="fixed left-4 right-4 bottom-4 max-w-4xl mx-auto" style={{ transform: 'translateX(-80px) translateY(-5px) scale(0.9)', transformOrigin: 'right center' }}>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
                  placeholder="输入你的问题..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isLoading}
                  className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 bg-white p-6 overflow-y-auto hidden lg:block">
          {/* Skill Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              技能简介
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              <div className="font-medium mb-2">{skill.name}</div>
              <div className="text-gray-500 text-xs mb-3">
                {skill.expert.name} · {skill.expert.department}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-gray-600">功能说明：</span>
                  <p className="text-xs text-gray-600 mt-1">{skill.description}</p>
                </div>
                {skill.tags && skill.tags.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-600">标签：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {skill.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-amber-800 text-sm">咨询建议</span>
            </div>
            <ul className="text-xs text-amber-700 space-y-2">
              <li>• 描述具体场景和遇到的问题</li>
              <li>• 可以结合多个技巧或方法提问</li>
              <li>• 追问时可以说"请详细说明"</li>
              <li>• 涉及隐私信息时可简化描述</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
