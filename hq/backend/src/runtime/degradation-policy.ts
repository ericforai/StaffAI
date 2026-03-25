import type { ExecutorName, HostCapabilityLevel, HostId } from './host-adapters';

export interface HostDegradationInput {
  hostId: HostId;
  capabilityLevel: HostCapabilityLevel;
  supportsSampling: boolean;
  supportsInjection: boolean;
  supportsRuntimeExecution: boolean;
  requiredCapability: string;
}

export interface HostDegradationResult {
  mode: 'native' | 'partial' | 'advisory';
  degraded: boolean;
  notice: string;
}

export interface ExecutorDegradationInput {
  preferredExecutor: ExecutorName;
  availableExecutors: ExecutorName[];
  requiresSampling: boolean;
  supportsSampling: boolean;
}

export interface ExecutorDegradationResult {
  executor: ExecutorName | 'manual';
  executionMode: 'parallel' | 'serial' | 'manual';
  degraded: boolean;
  notice: string;
}

export function resolveHostDegradation(input: HostDegradationInput): HostDegradationResult {
  if (input.requiredCapability === 'host.inject' && !input.supportsInjection) {
    return {
      mode: 'advisory',
      degraded: true,
      notice: `${input.hostId} cannot inject instructions natively; use manual fallback guidance.`,
    };
  }

  if (!input.supportsRuntimeExecution || input.capabilityLevel === 'advisory') {
    return {
      mode: 'advisory',
      degraded: true,
      notice: `${input.hostId} is advisory only for this workflow.`,
    };
  }

  if (input.capabilityLevel === 'partial' || !input.supportsSampling) {
    return {
      mode: 'partial',
      degraded: true,
      notice: `${input.hostId} is running in partial mode with at least one manual fallback.`,
    };
  }

  return {
    mode: 'native',
    degraded: false,
    notice: `${input.hostId} can execute this workflow natively.`,
  };
}

export function resolveExecutorDegradation(input: ExecutorDegradationInput): ExecutorDegradationResult {
  if (input.availableExecutors.length === 0) {
    return {
      executor: 'manual',
      executionMode: 'manual',
      degraded: true,
      notice: 'No local executor is available; switch to manual fallback or Web UI.',
    };
  }

  const executor = input.availableExecutors.includes(input.preferredExecutor)
    ? input.preferredExecutor
    : input.availableExecutors[0];

  if (input.requiresSampling && !input.supportsSampling) {
    return {
      executor,
      executionMode: 'serial',
      degraded: true,
      notice: 'Sampling is unavailable; downgraded to serial execution.',
    };
  }

  return {
    executor,
    executionMode: input.requiresSampling ? 'parallel' : 'serial',
    degraded: executor !== input.preferredExecutor,
    notice:
      executor === input.preferredExecutor
        ? 'Preferred executor is available.'
        : `Preferred executor unavailable; using ${executor} instead.`,
  };
}
