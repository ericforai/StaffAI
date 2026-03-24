/**
 * 消息解析工具
 * 处理聊天消息中的 @提及
 */

export interface ParsedMessage {
  mentions: string[];
  text: string;
}

/**
 * 从文本中提取 @提及的用户名
 * @param text 输入文本
 * @returns 提取到的提及列表
 */
export function extractMentions(text: string): string[] {
  const mentionPattern = /@(\S+)/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

/**
 * 检查用户名是否匹配提及
 * @param mention 提及的名称（无@符号）
 * @param agentName 专家全名
 */
export function isMentionMatch(mention: string, agentName: string): boolean {
  const normalizedMention = mention.toLowerCase();
  const normalizedAgentName = agentName.replace(/\s+/g, '').toLowerCase();
  const agentNameLower = agentName.toLowerCase();

  return (
    normalizedAgentName === normalizedMention ||
    agentNameLower.includes(normalizedMention)
  );
}

/**
 * 将文本分割为普通文本和提及部分
 * @param text 输入文本
 * @returns 分割后的片段数组
 */
export function splitTextWithMentions(text: string): string[] {
  return text.split(/(@\S+)/);
}

/**
 * 检查字符串是否为提及
 */
export function isMention(text: string): boolean {
  return text.startsWith('@');
}
