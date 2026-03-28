import type { RuntimeExecutionResult } from '../runtime/runtime-adapter';

/**
 * Result of assignment execution with retry info
 */
export interface AssignmentExecutionWithRetryResult {
  success: boolean;
  outputSummary?: string;
  outputSnapshot?: Record<string, unknown>;
  error?: string;
  attempts: number;
}

/**
 * Track a running assignment in the assignments map
 */
export function trackRunningAssignment(
  runningAssignments: Map<string, { assignmentId: string; status: string; startedAt?: string }>,
  assignmentId: string,
  status: string
): void {
  runningAssignments.set(assignmentId, {
    assignmentId,
    status,
    startedAt: new Date().toISOString(),
  });
}

/**
 * Execute assignment with timeout and retry logic
 */
export async function executeAssignmentWithRetry(
  runtimePromise: Promise<RuntimeExecutionResult>,
  timeoutMs: number,
  maxRetries: number,
  isRetriableError: (error: string) => boolean
): Promise<AssignmentExecutionWithRetryResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const runtimeResult = await withTimeout(runtimePromise, timeoutMs);

      return {
        success: true,
        outputSummary: runtimeResult.outputSummary,
        outputSnapshot: runtimeResult.outputSnapshot,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      if (attempt < maxRetries && isRetriableError(lastError)) {
        continue;
      }
    }
  }

  return {
    success: false,
    error: lastError ?? '执行失败',
    attempts: maxRetries,
  };
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
