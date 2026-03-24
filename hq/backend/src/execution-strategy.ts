export type ExecutionMode = 'auto' | 'force_serial' | 'require_sampling';
export type ExecutionModeApplied = 'parallel' | 'serial';

export interface SessionCapabilities {
  sampling: boolean;
}

export interface StructuredExecutionError {
  reason: string;
  impact: string;
  actions: Array<{
    key: 'switch_client' | 'auto_downgrade' | 'single_expert';
    label: string;
    description: string;
  }>;
}

export interface ExecutionDecision {
  requestedMode: ExecutionMode;
  appliedMode: ExecutionModeApplied;
  degraded: boolean;
  blocked: boolean;
  notice?: string;
  error?: StructuredExecutionError;
}

export function normalizeExecutionMode(input: unknown): ExecutionMode {
  if (input === 'force_serial' || input === 'require_sampling' || input === 'auto') {
    return input;
  }
  return 'auto';
}

export function resolveExecutionDecision(
  capabilities: SessionCapabilities,
  requestedMode: ExecutionMode
): ExecutionDecision {
  if (requestedMode === 'force_serial') {
    return {
      requestedMode,
      appliedMode: 'serial',
      degraded: false,
      blocked: false,
      notice: '已按会话策略强制串行执行。',
    };
  }

  if (requestedMode === 'require_sampling') {
    if (capabilities.sampling) {
      return {
        requestedMode,
        appliedMode: 'parallel',
        degraded: false,
        blocked: false,
      };
    }

    return {
      requestedMode,
      appliedMode: 'serial',
      degraded: false,
      blocked: true,
      error: {
        reason: '当前客户端未开启 sampling 能力。',
        impact: '无法执行并行多专家任务分配。',
        actions: [
          {
            key: 'switch_client',
            label: '切换支持端',
            description: '切换到支持 sampling 的客户端后重试并行执行。',
          },
          {
            key: 'auto_downgrade',
            label: '自动降级',
            description: '将执行模式改为 auto，自动使用串行咨询兜底。',
          },
          {
            key: 'single_expert',
            label: '继续单专家',
            description: '改用 consult_the_agency 获取单专家建议。',
          },
        ],
      },
    };
  }

  if (capabilities.sampling) {
    return {
      requestedMode,
      appliedMode: 'parallel',
      degraded: false,
      blocked: false,
    };
  }

  return {
    requestedMode,
    appliedMode: 'serial',
    degraded: true,
    blocked: false,
    notice: '当前会话 sampling=off，已自动降级为串行咨询执行。',
  };
}

export function defaultSessionCapabilities(): SessionCapabilities {
  return { sampling: false };
}
