import type express from 'express';
import type { DiscussionService } from '../discussion-service';
import type { Store } from '../store';
import type { DashboardEvent } from '../observability/dashboard-events';
import { normalizeExecutionMode, resolveExecutionDecision, StructuredExecutionError } from '../execution-strategy';

interface DiscussionRouteDependencies {
  discussionService: DiscussionService;
  store: Store;
  broadcast: (event: DashboardEvent) => void;
}

function getSamplingPolicy(): 'client' | 'force_on' | 'force_off' {
  const raw = (process.env.AGENCY_MCP_SAMPLING_POLICY || 'client').toLowerCase();
  if (raw === 'force_on' || raw === 'force_off' || raw === 'client') {
    return raw;
  }
  return 'client';
}

function getGatewayCapabilities() {
  const samplingPolicy = getSamplingPolicy();
  const sampling = samplingPolicy === 'force_on' ? true : samplingPolicy === 'force_off' ? false : false;
  return {
    capabilities: {
      sampling,
    },
    samplingPolicy,
  };
}

export function registerDiscussionRoutes(app: express.Application, dependencies: DiscussionRouteDependencies) {
  app.post('/api/discussions/search', (req, res) => {
    const { topic, participantCount } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }

    const experts = dependencies.discussionService.searchExperts(topic, participantCount);
    return res.json({ topic, experts });
  });

  app.post('/api/discussions/hire', (req, res) => {
    const { agentIds } = req.body;
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: 'agentIds must be a non-empty array' });
    }

    const result = dependencies.discussionService.hireExperts(agentIds);
    return res.json(result);
  });

  app.post('/api/discussions/run', async (req, res) => {
    const { topic, participantCount, agentIds } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }

    try {
      const result = await dependencies.discussionService.runDiscussion(topic, participantCount, agentIds);
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown discussion error';
      return res.status(503).json({ error: message });
    }
  });

  app.post('/api/mcp/find-experts', (req, res) => {
    const { topic, maxExperts } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }

    const experts = dependencies.discussionService.searchExperts(topic, maxExperts);
    return res.json({ topic, experts, tool: 'find_experts' });
  });

  app.post('/api/mcp/hire-experts', (req, res) => {
    const { agentIds } = req.body;
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: 'agentIds must be a non-empty array' });
    }

    const result = dependencies.discussionService.hireExperts(agentIds);
    return res.json({ ...result, tool: 'hire_experts' });
  });

  app.post('/api/mcp/expert-discussion', async (req, res) => {
    const { topic, participantCount, agentIds, executionMode } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }

    const gateway = getGatewayCapabilities();
    const capabilities = gateway.capabilities;
    const mode = normalizeExecutionMode(executionMode);
    const decision = resolveExecutionDecision(capabilities, mode);

    if (decision.blocked) {
      const error = decision.error as StructuredExecutionError;
      return res.status(409).json({
        error: `${error.reason} ${error.impact}`,
        reason: error.reason,
        impact: error.impact,
        actions: error.actions,
        capabilities,
        samplingPolicy: gateway.samplingPolicy,
        executionModeRequested: decision.requestedMode,
        executionModeApplied: null,
        degraded: false,
      });
    }

    try {
      const result = await dependencies.discussionService.runDiscussion(topic, participantCount, agentIds);
      return res.json({
        ...result,
        tool: 'expert_discussion',
        capabilities,
        samplingPolicy: gateway.samplingPolicy,
        executionModeRequested: decision.requestedMode,
        executionModeApplied: decision.appliedMode,
        degraded: decision.degraded || result.degraded,
        notice: decision.notice,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'expert_discussion failed';
      return res.status(503).json({ error: message });
    }
  });

  app.get('/api/mcp/capabilities', (_req, res) => {
    const gateway = getGatewayCapabilities();
    return res.json({
      capabilities: gateway.capabilities,
      samplingPolicy: gateway.samplingPolicy,
      supportedExecutionModes: ['auto', 'force_serial', 'require_sampling'],
      recommendedExecutionMode: gateway.capabilities.sampling ? 'require_sampling' : 'auto',
    });
  });

  app.post('/api/mcp/consult-the-agency', async (req, res) => {
    const { task } = req.body;
    if (!task || typeof task !== 'string') {
      return res.status(400).json({ error: 'task is required' });
    }

    try {
      const result = await dependencies.discussionService.consultTheAgency(task);
      return res.json({
        tool: 'consult_the_agency',
        task: result.task,
        text: result.response,
        executor: result.executor,
        agentId: result.expert.id,
        agentName: result.expert.name,
        expert: result.expert,
        autoHired: result.autoHired,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'consult_the_agency failed';
      return res.status(503).json({ error: message });
    }
  });

  app.post('/api/mcp/report-task-result', (req, res) => {
    const { task, agentId, resultSummary } = req.body;
    if (!task || typeof task !== 'string') {
      return res.status(400).json({ error: 'task is required' });
    }
    if (!agentId || typeof agentId !== 'string') {
      return res.status(400).json({ error: 'agentId is required' });
    }
    if (!resultSummary || typeof resultSummary !== 'string') {
      return res.status(400).json({ error: 'resultSummary is required' });
    }

    dependencies.store.saveKnowledge({
      task,
      agentId,
      resultSummary,
    });

    return res.json({
      success: true,
      tool: 'report_task_result',
      message: '任务结果已写入知识库。',
    });
  });

  app.post('/api/internal/event', (req, res) => {
    dependencies.broadcast(req.body);
    res.json({ success: true });
  });
}
