/**
 * WebSocket 连接管理 Hook
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_CONFIG, getWsUrl } from '../utils/constants';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type: string;
  taskEventType?:
    | 'task_created'
    | 'approval_requested'
    | 'approval_resolved'
    | 'execution_started'
    | 'execution_completed'
    | 'execution_failed'
    | 'execution_degraded';
  taskId?: string;
  approvalId?: string;
  executionId?: string;
  timestamp?: string;
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
  const lastWsUrlRef = useRef<string>(getWsUrl());
  const hasConnectedRef = useRef(false);
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
      const wsUrl = getWsUrl();
      lastWsUrlRef.current = wsUrl;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        hasConnectedRef.current = true;
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
        if (hasConnectedRef.current) {
          console.warn(`WebSocket disconnected; retrying in ${WS_CONFIG.RECONNECT_DELAY}ms.`);
        }
        // 3秒后重连
        reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
      };

      socket.onerror = (error) => {
        console.warn(`WebSocket connection failed for ${lastWsUrlRef.current}; waiting for reconnect.`);
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
