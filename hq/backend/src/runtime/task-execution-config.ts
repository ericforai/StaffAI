const DEFAULT_TASK_TIMEOUT_MS = 180_000;
const MIN_TIMEOUT_MS = 1_000;

function parsePositiveInt(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

export function getDefaultTaskTimeoutMs(): number {
  const fromEnv = parsePositiveInt(process.env.AGENCY_TASK_TIMEOUT_MS);
  if (fromEnv && fromEnv >= MIN_TIMEOUT_MS) {
    return fromEnv;
  }

  return DEFAULT_TASK_TIMEOUT_MS;
}

export function resolveTaskTimeoutMs(input?: number): number {
  const fromInput = parsePositiveInt(input);
  if (fromInput && fromInput >= MIN_TIMEOUT_MS) {
    return fromInput;
  }

  return getDefaultTaskTimeoutMs();
}
