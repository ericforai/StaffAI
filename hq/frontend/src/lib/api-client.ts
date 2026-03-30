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
