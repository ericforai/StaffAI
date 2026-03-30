import { LucideIcon, FileText, AlertCircle, CheckCircle2, Info } from 'lucide-react';

/**
 * 图标映射：把字符串名称映射到实际的 Lucide 图标组件
 */
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
};

function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || FileText;
}

/**
 * 清理多余的空行，只保留段落之间的单行空行
 */
export function cleanupExtraEmptyLines(text: string): string {
  return text
    .split('\n')
    .reduce((lines: string[], line) => {
      // 移除完全空行的连续重复，最多保留一个
      if (line.trim() === '') {
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.trim() !== '') {
          lines.push('');  // 只保留段落间的单行空行
        }
      } else {
        lines.push(line);
      }
      return lines;
    }, [] as string[])
    .join('\n')
    .trim();
}

/**
 * 增强的标题检测：根据关键词分配图标和级别
 */
export function detectSectionLevel(title: string): { iconName: string; level: 'good' | 'warning' | 'error' } {
  const lowerTitle = title.toLowerCase();

  // 错误级别 - 关键词检测
  const errorKeywords = ['🚨', 'critical', '问题', '错误', '失败', 'error', 'failed', 'bug', '缺失', 'missing', 'fix', '修复'];
  for (const keyword of errorKeywords) {
    if (lowerTitle.includes(keyword.toLowerCase()) || title.includes(keyword)) {
      return { iconName: 'AlertCircle', level: 'error' };
    }
  }

  // 警告级别
  const warningKeywords = ['⚠️', 'issues', '建议', '注意', 'warning', '建议改进', '可以改进', '推荐', 'recommend'];
  for (const keyword of warningKeywords) {
    if (lowerTitle.includes(keyword.toLowerCase()) || title.includes(keyword)) {
      return { iconName: 'AlertCircle', level: 'warning' };
    }
  }

  // 成功/正常级别
  const goodKeywords = ['✅', '成功', 'working', '正确', '已完成', '分析', 'analysis', '结果', 'result', '优化', 'optimize'];
  for (const keyword of goodKeywords) {
    if (lowerTitle.includes(keyword.toLowerCase()) || title.includes(keyword)) {
      return { iconName: 'CheckCircle2', level: 'good' };
    }
  }

  // 默认使用 Info 图标
  return { iconName: 'Info', level: 'good' };
}

/**
 * Parse output summary and extract structured sections
 * 检测 ## 开头的标题，分配图标和级别
 */
export function parseOutputSummary(summary: string): { sections: Array<{ title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' }> } {
  // 先清理多余的空行
  const cleanedSummary = cleanupExtraEmptyLines(summary);
  const lines = cleanedSummary.split('\n');
  const sections: Array<{ title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' }> = [];

  let currentSection: { title: string; icon: LucideIcon; content: string; level: 'good' | 'warning' | 'error' } | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    // 跳过主标题 (# Title)，只处理 ## 二级标题
    if (line.startsWith('# ') && !line.startsWith('##')) {
      continue;
    }

    // 检测二级标题 (## Title)
    if (line.startsWith('## ')) {
      // 保存当前section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }

      // 解析新标题
      const title = line.slice(3).trim();
      const { iconName, level } = detectSectionLevel(title);

      currentSection = { title, icon: getIconComponent(iconName), content: '', level };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // 保存最后一个section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection);
  }

  // 如果没有检测到任何section，创建一个默认的
  if (sections.length === 0 && summary.trim()) {
    sections.push({
      title: '执行结果',
      icon: FileText,
      content: summary.trim(),
      level: 'good',
    });
  }

  return { sections };
}
