import type express from 'express';
import type { Scanner } from '../scanner';
import type { SkillScanner } from '../skill-scanner';
import type { Store } from '../store';
import type { DiscussionServiceContract } from '../shared/discussion-service-contract';
import { createCapabilityRegistry, bindAgentCapabilities } from '../runtime/capability-registry';
import { buildRecommendations } from '../runtime/recommendation-engine';
import { getHostAdapter, listHostAdapters, renderHostInjectionSnippet, type HostId } from '../runtime/host-adapters';
import type { RuntimePaths } from '../runtime/runtime-state';
import { writeRuntimeSnapshot } from '../runtime/runtime-state';
import { getHostPolicy, loadHostPolicyConfig, validateHostPolicyConfig } from '../governance/host-policy';
import {
  loadCapabilityBindingsConfig,
  resolveCapabilityBindings,
  validateCapabilityBindingsConfig,
} from '../governance/capability-bindings';

interface RuntimeRouteDependencies {
  scanner: Scanner;
  skillScanner: SkillScanner;
  store: Store;
  discussionService: DiscussionServiceContract;
  runtimePaths: RuntimePaths;
}

export function registerRuntimeRoutes(app: express.Application, dependencies: RuntimeRouteDependencies) {
  const loadRuntimeGovernance = async () => {
    const hosts = await listHostAdapters();
    const hostIds = hosts.map((host) => host.id);
    const hostPolicyConfig = await loadHostPolicyConfig();
    const bindingsConfig = await loadCapabilityBindingsConfig();
    const resolvedBindings = resolveCapabilityBindings(bindingsConfig.bindings, dependencies.scanner);
    const [hostPolicyValidation, bindingsValidation] = await Promise.all([
      validateHostPolicyConfig(hostIds),
      validateCapabilityBindingsConfig(dependencies.scanner, hostIds),
    ]);

    return {
      hostPolicyConfig,
      bindingsConfig,
      resolvedBindings,
      hostPolicyValidation,
      bindingsValidation,
    };
  };

  app.get('/api/runtime/hosts', async (_req, res) => {
    const hosts = await listHostAdapters();
    return res.json({
      runtime: {
        stateDir: dependencies.runtimePaths.rootDir,
      },
      hosts,
    });
  });

  app.get('/api/runtime/policies', async (_req, res) => {
    const hosts = await listHostAdapters();
    const hostIds = hosts.map((host) => host.id);
    const [config, validation] = await Promise.all([loadHostPolicyConfig(), validateHostPolicyConfig(hostIds)]);

    return res.json({
      runtime: {
        stateDir: dependencies.runtimePaths.rootDir,
      },
      policies: config.hosts,
      validation,
    });
  });

  app.get('/api/runtime/bindings', async (_req, res) => {
    const hosts = await listHostAdapters();
    const hostIds = hosts.map((host) => host.id);
    const config = await loadCapabilityBindingsConfig();
    const bindings = resolveCapabilityBindings(config.bindings, dependencies.scanner);
    const validation = await validateCapabilityBindingsConfig(dependencies.scanner, hostIds);

    return res.json({
      runtime: {
        stateDir: dependencies.runtimePaths.rootDir,
      },
      bindings,
      validation,
    });
  });

  app.get('/api/runtime/validate', async (_req, res) => {
    const governance = await loadRuntimeGovernance();
    return res.json({
      valid: governance.hostPolicyValidation.valid && governance.bindingsValidation.valid,
      policies: governance.hostPolicyValidation,
      bindings: governance.bindingsValidation,
    });
  });

  app.get('/api/runtime/hosts/:id', async (req, res) => {
    const host = await getHostAdapter(req.params.id as HostId);
    if (!host) {
      return res.status(404).json({ error: 'host not found' });
    }
    return res.json(host);
  });

  app.get('/api/runtime/hosts/:id/injection', async (req, res) => {
    const host = await getHostAdapter(req.params.id as HostId);
    if (!host) {
      return res.status(404).json({ error: 'host not found' });
    }

    return res.json({
      hostId: host.id,
      targetFile: host.injection.targetFile,
      strategy: host.injection.strategy,
      snippet: renderHostInjectionSnippet(host),
    });
  });

  app.get('/api/runtime/discovery', async (_req, res) => {
    const [hosts, skills] = await Promise.all([listHostAdapters(), dependencies.skillScanner.scan()]);
    const agents = dependencies.scanner.getAllAgents();
    const capabilities = createCapabilityRegistry();
    const boundAgents = agents.map((agent) => bindAgentCapabilities(agent));
    const governance = await loadRuntimeGovernance();

    const snapshot = {
      generatedAt: new Date().toISOString(),
      stateDir: dependencies.runtimePaths.rootDir,
      agents: agents.length,
      skills: skills.length,
      hostPolicies: governance.hostPolicyConfig.hosts.length,
      capabilityBindings: governance.bindingsConfig.bindings.length,
      hosts: hosts.map((host) => ({
        id: host.id,
        capabilityLevel: host.capabilityLevel,
        supportsSampling: host.supportsSampling,
        supportsInjection: host.supportsInjection,
      })),
    };

    await writeRuntimeSnapshot(dependencies.runtimePaths, 'runtime-discovery.json', snapshot);

    return res.json({
      runtime: snapshot,
      capabilities,
      boundAgents,
      hostPolicies: governance.hostPolicyConfig.hosts,
      capabilityBindings: governance.resolvedBindings,
      governanceValidation: {
        policies: governance.hostPolicyValidation,
        bindings: governance.bindingsValidation,
      },
    });
  });

  app.post('/api/runtime/recommend', async (req, res) => {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic : '';
    const hostId = (typeof req.body?.hostId === 'string' ? req.body.hostId : 'codex') as HostId;
    const activeAgentIds = Array.isArray(req.body?.activeAgentIds)
      ? req.body.activeAgentIds
      : dependencies.store.getActiveIds();

    if (!topic.trim()) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const [host, startupCheck] = await Promise.all([
      getHostAdapter(hostId),
      dependencies.discussionService.getStartupCheck(),
    ]);
    if (!host) {
      return res.status(404).json({ error: 'host not found' });
    }
    const hostPolicy = await getHostPolicy(host.id);

    const availableExecutors = startupCheck.checks.filter((check) => check.available).map((check) => check.name);

    const result = buildRecommendations({
      topic,
      hostId: host.id,
      capabilityLevel: host.capabilityLevel,
      availableExecutors,
      samplingEnabled: host.supportsSampling,
      activeAgentIds,
    });
    const filteredRecommendations =
      hostPolicy && hostPolicy.toolRouting.blockedTools.includes('expert_discussion')
        ? result.recommendations.filter((item) => item.action !== 'run_expert_discussion')
        : result.recommendations;

    return res.json({
      host,
      hostPolicy,
      ...result,
      recommendations: filteredRecommendations,
    });
  });
}
