export function formatExecutor(executor?: string) {
  switch (executor) {
    case 'claude':
      return 'Claude';
    case 'codex':
      return 'Codex';
    case 'openai':
      return 'OpenAI';
    case 'deerflow':
      return 'DeerFlow';
    default:
      return executor || '未知';
  }
}

export function formatRiskLevel(riskLevel?: string) {
  if (!riskLevel) {
    return '未标注';
  }

  switch (riskLevel) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中风险';
    case 'high':
      return '高风险';
    default:
      return riskLevel;
  }
}
