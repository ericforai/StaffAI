/**
 * 全局 WebSocket Hook - 使用单一的 WebSocket 连接
 */
import { useEffect } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketProvider';
import type { WsMessage, WsStatus } from '../contexts/WebSocketProvider';
import { registerWsHandler } from '../app/AppWebSocketProvider';

export interface UseGlobalWebSocketOptions {
  onMessage: (data: WsMessage) => void;
  onError?: (error: Event) => void;
}

export function useGlobalWebSocket({ onMessage }: UseGlobalWebSocketOptions) {
  const { status } = useWebSocketContext();

  useEffect(() => {
    // 注册消息处理器
    const unregister = registerWsHandler(onMessage);
    return unregister;
  }, [onMessage]);

  return { status };
}

// 重新导出类型以保持兼容性
export type { WsMessage, WsStatus };
