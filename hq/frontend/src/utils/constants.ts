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
  const actualHost = host === 'localhost' || !host ? 'localhost' : host;

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' && actualHost !== '127.0.0.1' ? 'wss' : 'ws';
  return `${protocol}://${actualHost}:${DEFAULT_BACKEND_PORT}`;
}

function getDefaultApiUrl() {
  if (typeof window !== 'undefined') {
    // 浏览器：同源 /api → next.config rewrites 转发到 HQ，避免跨域、局域网主机名、::1/127.0.0.1 混用导致的 fetch failed
    return '/api';
  }
  // SSR / 无 window：Node 直连后端（127.0.0.1 减少 IPv6 localhost 歧义）
  return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}/api`;
}

/** localhost / 127.0.0.1 / ::1 — 在浏览器里直连易被策略挡住，应走 Next /api 代理 */
function isLoopbackApiBaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]' || u.hostname === '::1';
  } catch {
    return false;
  }
}

function normalizeApiBase(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getWsUrl() {
  return process.env.NEXT_PUBLIC_WS_URL || getDefaultWsUrl();
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  const forceDirect = process.env.NEXT_PUBLIC_API_USE_DIRECT === '1';

  if (typeof window !== 'undefined') {
    // 浏览器：loopback 的 NEXT_PUBLIC_API_URL 与「同源 /api 代理」冲突，默认忽略 env，改走 /api
    if (fromEnv && forceDirect) {
      return normalizeApiBase(fromEnv);
    }
    if (fromEnv && !isLoopbackApiBaseUrl(fromEnv)) {
      return normalizeApiBase(fromEnv);
    }
    return '/api';
  }

  if (fromEnv) return normalizeApiBase(fromEnv);
  return getDefaultApiUrl();
}

// WebSocket 配置
export const WS_CONFIG = {
  URL: getWsUrl(),
  RECONNECT_DELAY: 3000,
} as const;

// API 配置（getter：浏览器端按当前页 hostname 解析后端，避免 SSR 把 BASE_URL 固定成 localhost 导致局域网访问失败）
export const API_CONFIG = {
  get BASE_URL(): string {
    return getApiBaseUrl();
  },
};

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

// 面向用户展示的中文描述（用于覆盖 agent frontmatter 中的英文 description）
export const AGENT_DESCRIPTION_ZH: Record<string, string> = {
  dispatcher:
    '负责路由任务、拆解工作、分派专家，并将产出汇总成清晰的交付叙事。',
};
