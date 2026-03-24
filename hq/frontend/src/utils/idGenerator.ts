/**
 * 安全的 ID 生成器
 * 使用 crypto API 生成唯一标识符
 */

function getCryptoApi(): Crypto | undefined {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  return undefined;
}

/**
 * 生成短格式的唯一 ID (12 字符)
 * 适用于消息、日志等临时实体
 */
export function generateShortId(): string {
  const cryptoApi = getCryptoApi();
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().slice(0, 12);
  }
  // 最后的 fallback (仅用于开发环境)
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 生成完整的 UUID
 */
export function generateUUID(): string {
  const cryptoApi = getCryptoApi();
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  throw new Error('UUID generation not available in this environment');
}
