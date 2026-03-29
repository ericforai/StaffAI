import { useState, useEffect } from 'react';

export type WorkshopStatus = 'connected' | 'disconnected' | 'loading';

export function useWorkshopHealth() {
  const [status, setStatus] = useState<WorkshopStatus>('loading');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('http://127.0.0.1:8000/health', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch (error) {
        setStatus('disconnected');
      }
    };

    // Initial check
    checkHealth();

    // Poll every 5 seconds
    const interval = setInterval(checkHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  return { status };
}
