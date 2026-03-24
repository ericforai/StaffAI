import { useCallback, useEffect, useState } from 'react';
import { API_CONFIG } from '../utils/constants';

export interface RuntimeHostSummary {
  id: string;
  label: string;
  capabilityLevel: 'full' | 'partial' | 'advisory';
  supportedExecutors: Array<'claude' | 'codex' | 'openai'>;
  supportsSampling: boolean;
  supportsInjection: boolean;
  supportsRuntimeExecution: boolean;
  degradation: {
    mode: 'native' | 'partial' | 'advisory';
    manualFallback: string;
  };
  injection: {
    targetFile: string;
    strategy: 'append' | 'replace' | 'manual';
    priority: 'primary' | 'secondary';
  };
}

export interface RuntimeCapability {
  id: string;
  label: string;
  description: string;
}

export interface RuntimeRecommendation {
  action: string;
  label: string;
  reason: string;
}

export function useRuntimeFoundation(topic: string, activeAgentIds: string[]) {
  const [hosts, setHosts] = useState<RuntimeHostSummary[]>([]);
  const [capabilities, setCapabilities] = useState<RuntimeCapability[]>([]);
  const [recommendations, setRecommendations] = useState<RuntimeRecommendation[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<'claude' | 'codex' | 'gemini'>('codex');
  const [runtimeStateDir, setRuntimeStateDir] = useState('~/.agency');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [hostsResponse, discoveryResponse, recommendationsResponse] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/runtime/hosts`),
        fetch(`${API_CONFIG.BASE_URL}/runtime/discovery`),
        fetch(`${API_CONFIG.BASE_URL}/runtime/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic || 'review current runtime readiness',
            hostId: selectedHostId,
            activeAgentIds,
          }),
        }),
      ]);

      const hostsPayload = (await hostsResponse.json()) as {
        runtime?: { stateDir?: string };
        hosts?: RuntimeHostSummary[];
      };
      const discoveryPayload = (await discoveryResponse.json()) as {
        capabilities?: RuntimeCapability[];
      };
      const recommendationPayload = (await recommendationsResponse.json()) as {
        recommendations?: RuntimeRecommendation[];
      };

      setHosts(hostsPayload.hosts || []);
      setCapabilities(discoveryPayload.capabilities || []);
      setRecommendations(recommendationPayload.recommendations || []);
      setRuntimeStateDir(hostsPayload.runtime?.stateDir || '~/.agency');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'runtime foundation load failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeAgentIds, selectedHostId, topic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentHost = hosts.find((host) => host.id === selectedHostId) || hosts[0] || null;

  return {
    hosts,
    currentHost,
    capabilities,
    recommendations,
    runtimeStateDir,
    selectedHostId,
    setSelectedHostId,
    refresh,
    loading,
    error,
  };
}
