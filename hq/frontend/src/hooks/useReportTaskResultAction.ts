import { useCallback, useState } from 'react';
import { API_CONFIG } from '../utils/constants';

export interface ReportTaskResultPayload {
  task: string;
  agentId: string;
  resultSummary: string;
}

export interface ReportTaskResultResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

interface UseReportTaskResultActionOptions {
  initialTask?: string;
  initialAgentId?: string;
  initialResultSummary?: string;
}

export function useReportTaskResultAction({
  initialTask = '',
  initialAgentId = '',
  initialResultSummary = '',
}: UseReportTaskResultActionOptions = {}) {
  const [task, setTask] = useState(initialTask);
  const [agentId, setAgentId] = useState(initialAgentId);
  const [resultSummary, setResultSummary] = useState(initialResultSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportTaskResultResponse | null>(null);

  const reportTaskResult = useCallback(async () => {
    const trimmedTask = task.trim();
    const trimmedAgentId = agentId.trim();
    const trimmedSummary = resultSummary.trim();

    if (!trimmedTask) {
      setError('请先填写任务描述。');
      return null;
    }

    if (!trimmedAgentId) {
      setError('请先填写执行专家 ID。');
      return null;
    }

    if (!trimmedSummary) {
      setError('请先填写结果摘要。');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/mcp/report-task-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: trimmedTask,
          agentId: trimmedAgentId,
          resultSummary: trimmedSummary,
        } satisfies ReportTaskResultPayload),
      });

      const data = (await response.json()) as ReportTaskResultResponse;
      if (!response.ok) {
        throw new Error(data.error || data.message || '记录任务结果失败。');
      }

      setResult(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : '记录任务结果失败。';
      setError(message);
      setResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [agentId, resultSummary, task]);

  const reset = useCallback(() => {
    setTask('');
    setAgentId('');
    setResultSummary('');
    setError(null);
    setResult(null);
    setLoading(false);
  }, []);

  return {
    task,
    setTask,
    agentId,
    setAgentId,
    resultSummary,
    setResultSummary,
    loading,
    error,
    result,
    reportTaskResult,
    reset,
  };
}
