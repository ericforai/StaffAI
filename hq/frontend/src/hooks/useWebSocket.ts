/**
 * WebSocket 连接管理 Hook
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_CONFIG } from '../utils/constants';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type: string;
  agentId?: string;
  agentName?: string;
  task?: string;
  topic?: string;
  tool?: 'consult_the_agency' | 'expert_discussion';
  stage?: string;
  message?: string;
  progress?: number;
  status?: 'started' | 'running' | 'completed' | 'failed';
  executor?: 'claude' | 'codex' | 'openai';
  participantCount?: number;
  participants?: Array<{ id: string; name: string }>;
  hiredAgentIds?: string[];
}

export interface UseWebSocketOptions {
  onMessage: (data: WsMessage) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({ onMessage, onError }: UseWebSocketOptions) {
  const [status, setWsStatus] = useState<WsStatus>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  // 使用 ref 存储 callbacks以避免依赖变化
  const callbacksRef = useRef({ onMessage, onError });

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = { onMessage, onError };
  }, [onMessage, onError]);

  const connect = useCallback(function connectSocket() {
    // 清理旧连接和定时器
    if (ws.current) {
      ws.current.close();
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }

    setWsStatus('connecting');

    try {
      const socket = new WebSocket(WS_CONFIG.URL);

      socket.onopen = () => {
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsMessage;
          callbacksRef.current.onMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        setWsStatus('disconnected');
        // 3秒后重连
        reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        callbacksRef.current.onError?.(error);
      };

      ws.current = socket;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
    }
  }, []); // 空依赖数组，connect 只在挂载时创建一次

  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connect]);

  return { status };
}
