'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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
  executor?: 'claude' | 'codex' | 'openai' | 'deerflow';
  participantCount?: number;
  participants?: Array<{ id: string; name: string }>;
  hiredAgentIds?: string[];
}

interface WebSocketContextValue {
  status: WsStatus;
  sendMessage: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  onMessage?: (data: WsMessage) => void;
}

export function WebSocketProvider({ children, onMessage }: WebSocketProviderProps) {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);
  const hasConnectedRef = useRef(false);

  // 更新回调引用
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let cancelled = false;
    let activeWs: WebSocket | null = null;

    const connectSocket = () => {
      // 清理旧连接和定时器
      if (activeWs) {
        activeWs.close();
        activeWs = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      if (cancelled) return;

      setStatus('connecting');

      try {
        const wsUrl = getWsUrl();
        const socket = new WebSocket(wsUrl);
        activeWs = socket;

        socket.onopen = () => {
          if (cancelled) {
            socket.close();
            return;
          }
          hasConnectedRef.current = true;
          setStatus('connected');
        };

        socket.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data) as WsMessage;
            onMessageRef.current?.(data);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        socket.onclose = () => {
          if (cancelled) return;
          setStatus('disconnected');
          activeWs = null;

          if (hasConnectedRef.current) {
            console.warn(`WebSocket disconnected; retrying in ${WS_CONFIG.RECONNECT_DELAY}ms.`);
          }

          if (!cancelled) {
            reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
          }
        };

        socket.onerror = (error) => {
          console.warn('WebSocket connection error:', error);
        };

        ws.current = socket;
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        if (cancelled) return;
        setStatus('disconnected');
        reconnectTimer.current = setTimeout(connectSocket, WS_CONFIG.RECONNECT_DELAY);
      }
    };

    connectSocket();

    return () => {
      cancelled = true;
      if (activeWs) {
        activeWs.close();
        activeWs = null;
      }
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, []); // 只在挂载时运行一次

  const sendMessage = (message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return (
    <WebSocketContext.Provider value={{ status, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}
