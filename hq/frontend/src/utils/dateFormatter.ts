/**
 * 将 ISO 8601 时间戳格式化为友好的中文时间格式
 * @param isoString ISO 8601 格式的时间字符串 (如 "2026-03-26T09:43:18.179Z")
 * @param fallback 当输入无效时的默认返回值 (默认为 "未知")
 * @returns 格式化后的时间字符串 (如 "2026-03-26 09:43:18")
 */
export function formatTimestamp(isoString?: string | null, fallback = '未知'): string {
  if (!isoString) {
    return fallback;
  }
  try {
    const date = new Date(isoString);
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return fallback;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return fallback;
  }
}

/**
 * 将 ISO 8601 时间戳格式化为日期格式 (不含时间)
 * @param isoString ISO 8601 格式的时间字符串
 * @param fallback 当输入无效时的默认返回值 (默认为 "未知")
 * @returns 格式化后的日期字符串 (如 "2026-03-26")
 */
export function formatDate(isoString?: string | null, fallback = '未知'): string {
  if (!isoString) {
    return fallback;
  }
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return fallback;
  }
}
