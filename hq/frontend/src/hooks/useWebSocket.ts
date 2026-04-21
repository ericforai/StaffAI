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
    | 'execution_degraded'
    | 'execution_event';
  payload?: any;
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
  executor?: 'claude' | 'codex' | 'gemini' | 'openai' | 'deerflow';
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

  useEffect(() => {
    let cancelled = false;

    const connectSocket = () => {
      // 清理旧连接和定时器
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      if (cancelled) return;

      setWsStatus('connecting');

      try {
        const wsUrl = getWsUrl();
        lastWsUrlRef.current = wsUrl;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (cancelled) {
            socket.close();
            return;
          }
          hasConnectedRef.current = true;
          setWsStatus('connected');
        };

        socket.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data) as WsMessage;
            callbacksRef.current.onMessage(data);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        socket.onclose = () => {
          if (cancelled) return;
          setWsStatus('disconnected');
          if (hasConnectedRef.current) {
            console.warn(`WebSocket disconnected; retrying in ${WS_CONFIG.RECONNECT_DELAY}ms.`);
          }
          // 3秒后重连
          if (!cancelled) {
            reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
          }
        };

        socket.onerror = (error) => {
          console.warn(`WebSocket connection failed for ${lastWsUrlRef.current}; waiting for reconnect.`);
          callbacksRef.current.onError?.(error);
        };

        ws.current = socket;
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        if (cancelled) return;
        setWsStatus('disconnected');
        reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
      }
    };

    connectSocket();

    return () => {
      cancelled = true;
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, []); // 空依赖数组，只在挂载时运行一次

  return { status };
}
