import { API_CONFIG } from '../utils/constants';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  body?: any;
  params?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  payload: any;

  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * 核心请求封装
 */
async function request<T>(
  method: HttpMethod,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, params, headers, ...rest } = options;

  // 构造 URL 与 Query 参数
  let url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_CONFIG.BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // 默认 Header
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 构造 Fetch 参数
  const config: RequestInit = {
    method,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...rest,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        data?.error || `请求失败: ${response.status} ${response.statusText}`,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    throw new ApiError(
      error instanceof Error ? error.message : '网络请求发生意外错误',
      500
    );
  }
}

/**
 * ApiClient 接口收口
 */
export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) => 
    request<T>('GET', url, options),
    
  post: <T>(url: string, body?: any, options?: RequestOptions) => 
    request<T>('POST', url, { ...options, body }),
    
  put: <T>(url: string, body?: any, options?: RequestOptions) => 
    request<T>('PUT', url, { ...options, body }),
    
  patch: <T>(url: string, body?: any, options?: RequestOptions) => 
    request<T>('PATCH', url, { ...options, body }),
    
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>('DELETE', url, options),
};

// Elite Clone APIs
export async function getEliteSkills(): Promise<EliteSkill[]> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills`);
  if (!response.ok) throw new Error('Failed to fetch elite skills');
  const data = await response.json();
  return data.skills;
}

export async function getAllEliteSkills(): Promise<EliteSkill[]> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/all`);
  if (!response.ok) throw new Error('Failed to fetch all elite skills');
  const data = await response.json();
  return data.skills;
}

export async function getEliteSkill(id: string): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}`);
  if (!response.ok) throw new Error('Failed to fetch elite skill');
  const data = await response.json();
  return data.skill;
}

export async function getEliteSkillContent(id: string): Promise<string> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}/content`);
  if (!response.ok) throw new Error('Failed to fetch skill content');
  const data = await response.json();
  return data.content;
}

export async function createEliteSkill(input: CreateSkillInput): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create elite skill');
  const data = await response.json();
  return data.skill;
}

export async function updateEliteSkill(id: string, input: Partial<CreateSkillInput>): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update elite skill');
  const data = await response.json();
  return data.skill;
}

export async function deleteEliteSkill(id: string): Promise<void> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete elite skill');
}

export async function publishEliteSkill(id: string): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}/publish`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to publish elite skill');
  const data = await response.json();
  return data.skill;
}

export async function deprecateEliteSkill(id: string): Promise<EliteSkill> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}/deprecate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to deprecate elite skill');
  const data = await response.json();
  return data.skill;
}

export async function consultEliteSkill(id: string, question: string): Promise<ConsultResponse> {
  const response = await fetch(`${API_CONFIG.BASE_URL}/elite/skills/${id}/consult`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error('Failed to consult elite skill');
  return response.json();
}

// Types
export interface EliteSkill {
  id: string;
  name: string;
  description: string;
  version?: string;
  expert: { name: string; department: string; title: string };
  category: string;
  tags: string[];
  status: 'pending' | 'published' | 'deprecated';
  installCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  version?: string;
  expert: { name: string; department: string; title: string };
  category: string;
  tags: string[];
  content: string;
}

export interface ConsultResponse {
  answer: string;
  skillId: string;
  skillName: string;
}
