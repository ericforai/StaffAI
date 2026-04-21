import { API_CONFIG } from './constants';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetch from the backend API with safe JSON parsing.
 * Throws ApiError if the response is non-OK, with a clear message
 * even when the response is HTML instead of JSON.
 */
export async function apiFetch<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${path}`);

    if (!response.ok) {
      let errorMsg = `请求失败 (${response.status})`;
      try {
        const errorData = await response.json() as { error?: string };
        if (errorData.error) errorMsg = errorData.error;
      } catch {
        // Response was not JSON (e.g., HTML error page from proxy)
        if (response.status === 404) errorMsg = '资源不存在。';
      }
      throw new ApiError(errorMsg, response.status);
    }

    return (await response.json()) as T;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw error;
  }
}
