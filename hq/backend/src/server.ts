import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Scanner } from './scanner';
import { SkillScanner } from './skill-scanner';
import { Store } from './store';
import { DiscussionService, DashboardEvent, StartupCheckResult } from './discussion-service';
import {
  normalizeExecutionMode,
  resolveExecutionDecision,
  StructuredExecutionError,
} from './execution-strategy';
import { createCapabilityRegistry, bindAgentCapabilities } from './capability-registry';
import { buildRecommendations } from './recommendation-engine';
import { getHostAdapter, listHostAdapters, renderHostInjectionSnippet, type HostId } from './host-adapters';
import { createRuntimePaths, writeRuntimeSnapshot } from './runtime-state';
import {
  getHostPolicy,
  loadHostPolicyConfig,
  validateHostPolicyConfig,
} from './host-policy';
import {
  loadCapabilityBindingsConfig,
  resolveCapabilityBindings,
  validateCapabilityBindingsConfig,
} from './capability-bindings';

export class WebServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private scanner: Scanner;
  private skillScanner: SkillScanner;
  private store: Store;
  private discussionService: DiscussionService;
  private runtimePaths = createRuntimePaths();

  constructor(scanner: Scanner, store: Store, skillScanner: SkillScanner) {
    this.app = express();
    this.scanner = scanner;
    this.skillScanner = skillScanner;
    this.store = store;

    this.app.use(cors());
    this.app.use(express.json());
    
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.discussionService = new DiscussionService(scanner, store, (event) => this.broadcast(event));

    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupRoutes() {
    const loadRuntimeGovernance = async () => {
      const hosts = await listHostAdapters();
      const hostIds = hosts.map((host) => host.id);
      const hostPolicyConfig = await loadHostPolicyConfig();
      const bindingsConfig = await loadCapabilityBindingsConfig();
      const resolvedBindings = resolveCapabilityBindings(bindingsConfig.bindings, this.scanner);
      const [hostPolicyValidation, bindingsValidation] = await Promise.all([
        validateHostPolicyConfig(hostIds),
        validateCapabilityBindingsConfig(this.scanner, hostIds),
      ]);

      return {
        hostPolicyConfig,
        bindingsConfig,
        resolvedBindings,
        hostPolicyValidation,
        bindingsValidation,
      };
    };

    const getSamplingPolicy = (): 'client' | 'force_on' | 'force_off' => {
      const raw = (process.env.AGENCY_MCP_SAMPLING_POLICY || 'client').toLowerCase();
      if (raw === 'force_on' || raw === 'force_off' || raw === 'client') {
        return raw;
      }
      return 'client';
    };

    const getGatewayCapabilities = () => {
      const samplingPolicy = getSamplingPolicy();
      const sampling = samplingPolicy === 'force_on' ? true : samplingPolicy === 'force_off' ? false : false;
      return {
        capabilities: {
          sampling,
        },
        samplingPolicy,
      };
    };

    this.app.get('/api/startup-check', async (_req, res) => {
      try {
        const status = await this.discussionService.getStartupCheck();
        return res.json(status);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Startup check failed';
        return res.status(500).json({ error: message });
      }
    });

    this.app.get('/startup-check', async (_req, res) => {
      try {
        const status = await this.discussionService.getStartupCheck();
        return res.type('html').send(this.renderStartupCheckPage(status));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Startup check failed';
        return res.status(500).type('html').send(this.renderStartupCheckFailurePage(message));
      }
    });

    this.app.get('/api/agents', (req, res) => {
      const agents = this.scanner.getAllAgents().map(a => ({
        id: a.id,
        department: a.department,
        frontmatter: a.frontmatter
      }));
      res.json(agents);
    });

    this.app.get('/api/skills', async (_req, res) => {
      const skills = await this.skillScanner.scan();
      const hostCounts = skills.flatMap((skill) => skill.installations).reduce<Record<string, number>>((acc, installation) => {
        acc[installation.host] = (acc[installation.host] || 0) + 1;
        return acc;
      }, {});

      res.json({
        summary: {
          totalSkills: skills.length,
          hostCounts,
        },
        skills,
      });
    });

    this.app.get('/api/runtime/hosts', async (_req, res) => {
      const hosts = await listHostAdapters();
      return res.json({
        runtime: {
          stateDir: this.runtimePaths.rootDir,
        },
        hosts,
      });
    });

    this.app.get('/api/runtime/policies', async (_req, res) => {
      const hosts = await listHostAdapters();
      const hostIds = hosts.map((host) => host.id);
      const [config, validation] = await Promise.all([
        loadHostPolicyConfig(),
        validateHostPolicyConfig(hostIds),
      ]);

      return res.json({
        runtime: {
          stateDir: this.runtimePaths.rootDir,
        },
        policies: config.hosts,
        validation,
      });
    });

    this.app.get('/api/runtime/bindings', async (_req, res) => {
      const hosts = await listHostAdapters();
      const hostIds = hosts.map((host) => host.id);
      const config = await loadCapabilityBindingsConfig();
      const bindings = resolveCapabilityBindings(config.bindings, this.scanner);
      const validation = await validateCapabilityBindingsConfig(this.scanner, hostIds);

      return res.json({
        runtime: {
          stateDir: this.runtimePaths.rootDir,
        },
        bindings,
        validation,
      });
    });

    this.app.get('/api/runtime/validate', async (_req, res) => {
      const governance = await loadRuntimeGovernance();
      return res.json({
        valid: governance.hostPolicyValidation.valid && governance.bindingsValidation.valid,
        policies: governance.hostPolicyValidation,
        bindings: governance.bindingsValidation,
      });
    });

    this.app.get('/api/runtime/hosts/:id', async (req, res) => {
      const host = await getHostAdapter(req.params.id as HostId);
      if (!host) {
        return res.status(404).json({ error: 'host not found' });
      }
      return res.json(host);
    });

    this.app.get('/api/runtime/hosts/:id/injection', async (req, res) => {
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

    this.app.get('/api/runtime/discovery', async (_req, res) => {
      const [hosts, skills] = await Promise.all([listHostAdapters(), this.skillScanner.scan()]);
      const agents = this.scanner.getAllAgents();
      const capabilities = createCapabilityRegistry();
      const boundAgents = agents.map((agent) => bindAgentCapabilities(agent));
      const governance = await loadRuntimeGovernance();

      const snapshot = {
        generatedAt: new Date().toISOString(),
        stateDir: this.runtimePaths.rootDir,
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

      await writeRuntimeSnapshot(this.runtimePaths, 'runtime-discovery.json', snapshot);

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

    this.app.post('/api/runtime/recommend', async (req, res) => {
      const topic = typeof req.body?.topic === 'string' ? req.body.topic : '';
      const hostId = (typeof req.body?.hostId === 'string' ? req.body.hostId : 'codex') as HostId;
      const activeAgentIds = Array.isArray(req.body?.activeAgentIds) ? req.body.activeAgentIds : this.store.getActiveIds();

      if (!topic.trim()) {
        return res.status(400).json({ error: 'topic is required' });
      }

      const [host, startupCheck] = await Promise.all([getHostAdapter(hostId), this.discussionService.getStartupCheck()]);
      if (!host) {
        return res.status(404).json({ error: 'host not found' });
      }
      const hostPolicy = await getHostPolicy(host.id);

      const availableExecutors = startupCheck.checks
        .filter((check) => check.available)
        .map((check) => check.name);

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

    this.app.get('/api/squad', (req, res) => {
      res.json({ activeAgentIds: this.store.getActiveIds() });
    });

    this.app.post('/api/squad', (req, res) => {
      const { activeAgentIds } = req.body;
      if (!Array.isArray(activeAgentIds)) {
        return res.status(400).json({ error: 'activeAgentIds must be an array' });
      }
      this.store.save(activeAgentIds);
      this.broadcast({ type: 'SQUAD_UPDATED', activeAgentIds });
      res.json({ success: true, activeAgentIds });
    });

    this.app.get('/api/templates', (req, res) => {
      res.json(this.store.getTemplates());
    });

    this.app.post('/api/templates', (req, res) => {
      const { name, activeAgentIds } = req.body;
      if (!name || !Array.isArray(activeAgentIds)) {
        return res.status(400).json({ error: 'Name and activeAgentIds required' });
      }
      this.store.saveTemplate(name, activeAgentIds);
      res.json({ success: true });
    });

    this.app.delete('/api/templates/:name', (req, res) => {
      this.store.deleteTemplate(req.params.name);
      res.json({ success: true });
    });

    this.app.post('/api/discussions/search', (req, res) => {
      const { topic, participantCount } = req.body;
      if (!topic || typeof topic !== 'string') {
        return res.status(400).json({ error: 'topic is required' });
      }

      const experts = this.discussionService.searchExperts(topic, participantCount);
      return res.json({ topic, experts });
    });

    this.app.post('/api/discussions/hire', (req, res) => {
      const { agentIds } = req.body;
      if (!Array.isArray(agentIds) || agentIds.length === 0) {
        return res.status(400).json({ error: 'agentIds must be a non-empty array' });
      }

      const result = this.discussionService.hireExperts(agentIds);
      return res.json(result);
    });

    this.app.post('/api/discussions/run', async (req, res) => {
      const { topic, participantCount, agentIds } = req.body;
      if (!topic || typeof topic !== 'string') {
        return res.status(400).json({ error: 'topic is required' });
      }

      try {
        const result = await this.discussionService.runDiscussion(topic, participantCount, agentIds);
        return res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown discussion error';
        return res.status(503).json({ error: message });
      }
    });

    this.app.post('/api/mcp/find-experts', (req, res) => {
      const { topic, maxExperts } = req.body;
      if (!topic || typeof topic !== 'string') {
        return res.status(400).json({ error: 'topic is required' });
      }

      const experts = this.discussionService.searchExperts(topic, maxExperts);
      return res.json({ topic, experts, tool: 'find_experts' });
    });

    this.app.post('/api/mcp/hire-experts', (req, res) => {
      const { agentIds } = req.body;
      if (!Array.isArray(agentIds) || agentIds.length === 0) {
        return res.status(400).json({ error: 'agentIds must be a non-empty array' });
      }

      const result = this.discussionService.hireExperts(agentIds);
      return res.json({ ...result, tool: 'hire_experts' });
    });

    this.app.post('/api/mcp/expert-discussion', async (req, res) => {
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
        const result = await this.discussionService.runDiscussion(topic, participantCount, agentIds);
        return res.json({
          ...result,
          tool: 'expert_discussion',
          capabilities,
          samplingPolicy: gateway.samplingPolicy,
          executionModeRequested: decision.requestedMode,
          executionModeApplied: decision.appliedMode,
          degraded: decision.degraded,
          notice: decision.notice,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'expert_discussion failed';
        return res.status(503).json({ error: message });
      }
    });

    this.app.get('/api/mcp/capabilities', (_req, res) => {
      const gateway = getGatewayCapabilities();
      return res.json({
        capabilities: gateway.capabilities,
        samplingPolicy: gateway.samplingPolicy,
        supportedExecutionModes: ['auto', 'force_serial', 'require_sampling'],
        recommendedExecutionMode: gateway.capabilities.sampling ? 'require_sampling' : 'auto',
      });
    });

    this.app.post('/api/mcp/consult-the-agency', async (req, res) => {
      const { task } = req.body;
      if (!task || typeof task !== 'string') {
        return res.status(400).json({ error: 'task is required' });
      }

      try {
        const result = await this.discussionService.consultTheAgency(task);
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

    this.app.post('/api/mcp/report-task-result', (req, res) => {
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

      this.store.saveKnowledge({
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

    // Special internal route for MCP server to broadcast agent activity
    this.app.post('/api/internal/event', (req, res) => {
      const event = req.body;
      console.log(`[Web Server] Internal Event Received: ${event.type}. Broadcasting to ${this.wss.clients.size} clients.`);
      this.broadcast(event);
      res.json({ success: true });
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('Dashboard connected via WebSocket');
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'The Agency HQ v2.0 Live' }));
    });
  }

  public broadcast(data: DashboardEvent) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public start(port: number) {
    void this.listen(port);
  }

  public listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.off('error', onError);
        reject(error);
      };

      this.server.once('error', onError);
      this.server.listen(port, '127.0.0.1', () => {
        this.server.off('error', onError);
        const address = this.server.address();
        const actualPort =
          typeof address === 'object' && address !== null ? address.port : port;
        console.log(`Agency HQ Web Server running on http://127.0.0.1:${actualPort}`);
        console.log(`Startup check available at http://127.0.0.1:${actualPort}/startup-check`);
        resolve(actualPort);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.clients.forEach((client) => client.terminate());
      this.wss.close((wsError) => {
        if (wsError) {
          reject(wsError);
          return;
        }
        this.server.close((serverError) => {
          if (serverError) {
            reject(serverError);
            return;
          }
          resolve();
        });
      });
    });
  }

  private renderStartupCheckPage(status: StartupCheckResult): string {
    const cards = status.checks
      .map((check) => {
        const tone =
          check.status === 'ready'
            ? 'border-color:#1d8f63;background:rgba(16,185,129,0.08);'
            : check.status === 'disabled'
              ? 'border-color:#6b7280;background:rgba(148,163,184,0.08);'
              : 'border-color:#9f1239;background:rgba(244,63,94,0.08);';

        return `
          <article style="border:1px solid;border-radius:20px;padding:20px;${tone}">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
              <h2 style="margin:0;font-size:20px;text-transform:uppercase;letter-spacing:.08em;">${check.name}</h2>
              <span style="font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);text-transform:uppercase;letter-spacing:.12em;">${check.status}</span>
            </div>
            <p style="margin:14px 0 0;color:#cbd5e1;line-height:1.6;">${check.detail}</p>
          </article>
        `;
      })
      .join('');

    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>HQ Startup Check</title>
  </head>
  <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:radial-gradient(circle at top left,rgba(22,163,74,.08),transparent 30%),radial-gradient(circle at top right,rgba(56,189,248,.10),transparent 30%),#07111c;color:#f8fafc;">
    <main style="max-width:1080px;margin:0 auto;padding:48px 24px 72px;">
      <p style="margin:0 0 10px;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#67e8f9;">The Agency HQ</p>
      <h1 style="margin:0;font-size:48px;line-height:1;font-weight:900;">Startup Check</h1>
      <p style="max-width:760px;margin:18px 0 0;color:#94a3b8;font-size:17px;line-height:1.7;">
        这个页面用于确认 HQ 后端是否已经准备好运行本地多代理讨论。默认执行器现在固定优先使用 Claude Code，其次才是 Codex，最后才回退到 OpenAI。
      </p>

      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:28px;">
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:rgba(15,23,42,.55);">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Preferred</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${status.preferredExecutor}</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:rgba(15,23,42,.55);">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Effective Default</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${status.effectiveDefaultExecutor}</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:rgba(15,23,42,.55);">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Timeout</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${Math.round(status.discussionTimeoutMs / 1000)}s</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;background:${status.overallReady ? 'rgba(16,185,129,.10)' : 'rgba(244,63,94,.10)'};">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;">Overall</div>
          <div style="margin-top:12px;font-size:28px;font-weight:900;">${status.overallReady ? 'READY' : 'BLOCKED'}</div>
        </div>
      </section>

      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px;">
        ${cards}
      </section>

      <section style="margin-top:24px;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:24px;background:rgba(15,23,42,.55);">
        <h2 style="margin:0 0 12px;font-size:20px;">Recommended startup state</h2>
        <ol style="margin:0;padding-left:18px;color:#cbd5e1;line-height:1.8;">
          <li>Keep <code>AGENCY_DISCUSSION_EXECUTOR=claude</code> or leave it unset.</li>
          <li>Make sure the local Claude Code CLI is logged in and usable.</li>
          <li>Use Codex only as a secondary path until its local runtime is stable.</li>
        </ol>
      </section>
    </main>
  </body>
</html>`;
  }

  private renderStartupCheckFailurePage(message: string): string {
    return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>HQ Startup Check</title></head>
  <body style="margin:0;background:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="max-width:760px;margin:0 auto;padding:56px 24px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#fda4af;">The Agency HQ</p>
      <h1 style="margin:0;font-size:42px;font-weight:900;">Startup Check Failed</h1>
      <p style="margin-top:18px;color:#cbd5e1;line-height:1.7;">${message}</p>
    </main>
  </body>
</html>`;
  }
}
