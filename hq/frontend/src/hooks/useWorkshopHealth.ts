import { useState, useEffect } from 'react';

export type WorkshopStatus = 'connected' | 'disconnected' | 'loading';

function workshopHealthCheckUrl(): string {
  const base = (process.env.NEXT_PUBLIC_WORKSHOP_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
  return `${base}/health`;
}

function workshopHealthCheckDisabled(): boolean {
  const v = process.env.NEXT_PUBLIC_DISABLE_WORKSHOP_HEALTH;
  return v === '1' || v === 'true';
}

export function useWorkshopHealth() {
  const [status, setStatus] = useState<WorkshopStatus>('loading');

  useEffect(() => {
    if (workshopHealthCheckDisabled()) {
      setStatus('disconnected');
      return;
    }

    const healthUrl = workshopHealthCheckUrl();
    let cancelled = false;

    const checkHealth = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(healthUrl, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (response.ok) {
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setStatus('disconnected');
        }
      }
    };

    void checkHealth();
    const interval = setInterval(() => void checkHealth(), 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { status };
}
