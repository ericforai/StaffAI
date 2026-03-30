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

export function formatTaskStatus(status: string) {
  switch (status) {
    case 'created':
      return '待执行';
    case 'waiting_approval':
      return '等待审批';
    case 'completed':
      return '已完成';
    case 'running':
      return '执行中';
    case 'failed':
      return '执行失败';
    case 'cancelled':
      return '已取消';
    case 'pending':
      return '待开始';
    case 'routed':
      return '已分配';
    default:
      return status;
  }
}

export function formatExecutionMode(mode: string) {
  switch (mode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    case 'advanced_discussion':
      return '高级讨论';
    case 'auto':
      return '自动';
    default:
      return mode;
  }
}

export function formatWorkflowPlanMode(mode: string) {
  switch (mode) {
    case 'single':
      return '单任务';
    case 'serial':
      return '串行';
    case 'parallel':
      return '并行';
    default:
      return mode;
  }
}

export function formatWorkflowStepStatus(status?: string) {
  if (!status) {
    return '待确认';
  }

  switch (status) {
    case 'pending':
      return '待处理';
    case 'running':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'skipped':
      return '已跳过';
    default:
      return status;
  }
}

export function formatApprovalStatus(status: string) {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'approved':
      return '已批准';
    case 'rejected':
      return '已拒绝';
    default:
      return status;
  }
}

export function formatAssignmentRole(role?: string) {
  switch (role) {
    case 'primary':
      return '主执行者';
    case 'secondary':
      return '协助者';
    case 'dispatcher':
      return '调度员';
    default:
      return role || '';
  }
}

export function formatExecutionStatus(status: string) {
  switch (status) {
    case 'succeeded':
    case 'completed':
      return '成功';
    case 'failed':
      return '失败';
    case 'running':
      return '执行中';
    case 'pending':
      return '等待中';
    default:
      return status;
  }
}

export function formatTraceEventType(type: string) {
  switch (type) {
    case 'execution_started':
      return '任务开始执行';
    case 'execution_completed':
      return '执行完成';
    case 'execution_failed':
      return '执行失败';
    case 'execution_cancelled':
      return '执行取消';
    case 'execution_degraded':
      return '降级执行';
    case 'execution_event':
      return 'AI 实时推导';
    case 'cost_observed':
      return '成本统计';
    case 'tool_call_logged':
      return '工具调用';
    default:
      return type;
  }
}

export function formatTaskEventType(type: string) {
  switch (type) {
    case 'execution_started':
      return '任务开始执行';
    case 'execution_completed':
      return '执行完成';
    case 'execution_failed':
      return '执行失败';
    case 'execution_cancelled':
      return '执行取消';
    case 'execution_degraded':
      return '降级执行';
    case 'execution_event':
      return 'AI 实时推导';
    case 'cost_observed':
      return '成本统计';
    case 'tool_call_logged':
      return '工具调用';
    case 'TASK_EVENT':
      return '任务事件';
    case 'AGENT_WORKING':
      return '专家工作中';
    case 'AGENT_HIRED':
      return '专家已加入';
    case 'AGENT_FIRED':
      return '专家已移出';
    case 'SQUAD_UPDATED':
      return '阵容已更新';
    case 'CONNECTED':
      return '已连接';
    case 'AGENT_ASSIGNED':
      return '任务已分配';
    case 'AGENT_TASK_COMPLETED':
      return '专家任务完成';
    case 'DISCUSSION_STARTED':
      return '讨论已开始';
    case 'DISCUSSION_COMPLETED':
      return '讨论已完成';
    case 'TOOL_PROGRESS':
      return '执行进度';
    default:
      return type;
  }
}
