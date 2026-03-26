/**
 * 应用常量配置
 * 集中管理所有魔法数字和配置值
 */

import {
  Palette,
  Cpu,
  LayoutGrid,
  Megaphone,
  Target,
  Briefcase,
  Activity,
  TestTube,
  HelpCircle,
  Laptop,
  Bot,
  type LucideIcon,
} from 'lucide-react';

const DEFAULT_BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || '3333';

function getBrowserBackendHost() {
  if (typeof window === 'undefined') {
    return 'localhost';
  }

  return window.location.hostname || 'localhost';
}

function getDefaultWsUrl() {
  const host = getBrowserBackendHost();
  const actualHost = host === 'localhost' || !host ? '127.0.0.1' : host;

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' && actualHost !== '127.0.0.1' ? 'wss' : 'ws';
  return `${protocol}://${actualHost}:${DEFAULT_BACKEND_PORT}`;
}

function getDefaultApiUrl() {
  const host = getBrowserBackendHost();
  const actualHost = host === 'localhost' || !host ? '127.0.0.1' : host;

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' && actualHost !== '127.0.0.1' ? 'https' : 'http';
  return `${protocol}://${actualHost}:${DEFAULT_BACKEND_PORT}/api`;
}

export function getWsUrl() {
  return process.env.NEXT_PUBLIC_WS_URL || getDefaultWsUrl();
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || getDefaultApiUrl();
}

// WebSocket 配置
export const WS_CONFIG = {
  URL: getWsUrl(),
  RECONNECT_DELAY: 3000,
} as const;

// API 配置
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
} as const;

// UI 配置
export const UI_CONFIG = {
  MAX_ACTIVITIES: 20,
  REACTION_DELAY_MIN: 1000,
  REACTION_DELAY_MAX: 3000,
  MESSAGE_SCROLL_DELAY: 100,
} as const;

// 部门映射配置
export const DEPT_MAP: Record<
  string,
  { label: string; icon: LucideIcon; color: string; gradient: string }
> = {
  design: {
    label: '设计部',
    icon: Palette,
    color: 'text-pink-400',
    gradient: 'from-pink-500/20 to-rose-500/20',
  },
  engineering: {
    label: '工程部',
    icon: Cpu,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  'game-development': {
    label: '游戏开发',
    icon: LayoutGrid,
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-indigo-500/20',
  },
  marketing: {
    label: '市场部',
    icon: Megaphone,
    color: 'text-orange-400',
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
  'paid-media': {
    label: '付费媒体',
    icon: Target,
    color: 'text-yellow-400',
    gradient: 'from-yellow-500/20 to-orange-500/20',
  },
  product: {
    label: '产品部',
    icon: Briefcase,
    color: 'text-red-400',
    gradient: 'from-red-500/20 to-pink-500/20',
  },
  'project-management': {
    label: '项目管理',
    icon: Activity,
    color: 'text-green-400',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  testing: {
    label: '测试部',
    icon: TestTube,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-blue-500/20',
  },
  support: {
    label: '支持部',
    icon: HelpCircle,
    color: 'text-indigo-400',
    gradient: 'from-indigo-500/20 to-purple-500/20',
  },
  'spatial-computing': {
    label: '空间计算',
    icon: Laptop,
    color: 'text-sky-400',
    gradient: 'from-sky-500/20 to-blue-500/20',
  },
  specialized: {
    label: '专家组',
    icon: Bot,
    color: 'text-rose-400',
    gradient: 'from-rose-500/20 to-red-500/20',
  },
};
