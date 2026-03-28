'use client';

import { useEffect, ReactNode } from 'react';
import { WebSocketProvider, type WsMessage } from '../contexts/WebSocketProvider';

// 全局消息处理器集合
const messageHandlers = new Set<(data: WsMessage) => void>();

export function registerWsHandler(handler: (data: WsMessage) => void) {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

export function AppWebSocketProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 组件卸载时清理所有处理器
    return () => {
      messageHandlers.clear();
    };
  }, []);

  return (
    <WebSocketProvider
      onMessage={(data) => {
        // 广播消息到所有注册的处理器
        messageHandlers.forEach((handler) => {
          try {
            handler(data);
          } catch (err) {
            console.error('Error in WS message handler:', err);
          }
        });
      }}
    >
      {children}
    </WebSocketProvider>
  );
}
