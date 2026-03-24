/**
 * Chat 功能 Hook
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { generateShortId } from '../utils/idGenerator';
import { extractMentions, isMentionMatch } from '../lib/messageParser';
import { UI_CONFIG } from '../utils/constants';
import { Agent } from '../types';

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  mentions: string[];
  senderEmoji?: string;
}

export interface ChatInputOptions {
  activeAgents: Agent[];
  onSendMessage: (message: Message) => void;
}

export function useChat({ activeAgents, onSendMessage }: ChatInputOptions) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateShortId(),
      sender: '系统中心',
      text: 'HQ 指挥链路已就绪。使用 @提及 已入职的专家进行协作。',
      timestamp: new Date(),
      mentions: [],
      senderEmoji: '🏢'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 添加提及到输入框
  const addMention = useCallback((agentName: string) => {
    setChatInput(prev => prev + `@${agentName.replace(/\s+/g, '')} `);
  }, []);

  // 发送消息
  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return;

    const mentions = extractMentions(chatInput);

    const newMessage: Message = {
      id: generateShortId(),
      sender: '司令官',
      text: chatInput,
      timestamp: new Date(),
      mentions,
      senderEmoji: '🛡️'
    };

    setMessages(prev => [...prev, newMessage]);
    setChatInput('');
    onSendMessage(newMessage);

    // 模拟被提及的 agent 的响应
    mentions.forEach(name => {
      const targetAgent = activeAgents.find(a =>
        isMentionMatch(name, a.frontmatter.name)
      );

      if (targetAgent) {
        const delay =
          UI_CONFIG.REACTION_DELAY_MIN +
          Math.random() * (UI_CONFIG.REACTION_DELAY_MAX - UI_CONFIG.REACTION_DELAY_MIN);

        setTimeout(() => {
          const response: Message = {
            id: generateShortId(),
            sender: targetAgent.frontmatter.name,
            text: `@司令官 已收到指令！正在针对 ${targetAgent.department} 模块启动实时分析与优化程序。`,
            timestamp: new Date(),
            mentions: ['司令官'],
            senderEmoji: targetAgent.frontmatter.emoji || '🤖'
          };
          setMessages(prev => [...prev, response]);
        }, delay);
      }
    });
  }, [chatInput, activeAgents, onSendMessage]);

  return {
    messages,
    chatInput,
    setChatInput,
    sendMessage,
    addMention,
    messagesEndRef,
  };
}
