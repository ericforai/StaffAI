/**
 * Normalize browser/network fetch failures into actionable copy (avoid raw "TypeError: fetch failed").
 *
 * Note: do not treat plain `Error` + substring `fetch failed` as browser network — HQ may forward
 * Node/undici upstream errors (e.g. LLM gateway) via SSE as `Error: TypeError: fetch failed`,
 * which must not be shown as "cannot reach HQ API".
 */
export function isLikelyNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const s = String(err);
  return /Failed to fetch|NetworkError when attempting to fetch|Load failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ERR_NETWORK|NSURLErrorDomain/i.test(
    s
  );
}

export function formatReachabilityError(err: unknown, apiBase: string): string {
  if (isLikelyNetworkFailure(err)) {
    const hint =
      apiBase === '/api'
        ? '浏览器走同源 /api，由 Next 转发到 HQ；请确认后端已启动且 next.config 中 HQ_BACKEND_ORIGIN 指向正确。'
        : '请确认 hq 后端已启动，且 NEXT_PUBLIC_BACKEND_PORT / NEXT_PUBLIC_API_URL 与后端一致。';
    return `无法连接后端 API（当前基址：${apiBase || '/api'}）。${hint}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Backend LLM/outbound fetch often surfaces this exact text in SSE `error` frames (undici). */
function looksLikeUpstreamFetchFailureMessage(err: unknown): boolean {
  const s = err instanceof Error ? err.message : String(err);
  return /TypeError:\s*fetch failed/i.test(s);
}

/** Intent wizard: distinguish browser→HQ failures from HQ→model gateway failures. */
export function formatIntentClientError(err: unknown, apiBase: string): string {
  if (isLikelyNetworkFailure(err)) {
    return formatReachabilityError(err, apiBase);
  }
  if (looksLikeUpstreamFetchFailureMessage(err)) {
    return (
      '澄清服务调用模型/上游接口失败（HQ 后端出站请求未成功）。' +
      '请检查 hq/backend 的 API Key、代理与防火墙；这与「浏览器连不上 HQ」不是同一类问题。'
    );
  }
  return err instanceof Error ? err.message : String(err);
}
