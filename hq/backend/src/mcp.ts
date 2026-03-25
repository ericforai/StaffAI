import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Scanner } from './scanner';
import { Store } from './store';
import { Agent } from './types';
import http from 'http';
import {
  defaultSessionCapabilities,
  ExecutionDecision,
  normalizeExecutionMode,
  resolveExecutionDecision,
  SessionCapabilities,
} from './execution-strategy';
import { createUserRepository } from './identity/user-repository.js';
import { createPermissionChecker } from './identity/permission-checker.js';
import { createUserContextService } from './identity/user-context.js';

interface RankedExpert {
  agent: Agent;
  score: number;
  isActive: boolean;
}

interface DiscussionParticipant extends RankedExpert {
  hiredForTask: boolean;
  assignment: string;
}

interface ExpertResponse {
  participant: DiscussionParticipant;
  response: string;
}

interface DashboardEvent {
  type: string;
  agentId?: string;
  agentName?: string;
  task?: string;
  topic?: string;
  participantCount?: number;
  participants?: Array<{ id: string; name: string }>;
  hiredAgentIds?: string[];
}

export class McpGateway {
  private server: Server;
  private scanner: Scanner;
  private store: Store;
  private webServerPort: number;
  private userContextService: ReturnType<typeof createUserContextService>;

  constructor(scanner: Scanner, store: Store, webServerPort: number = 3333) {
    this.scanner = scanner;
    this.store = store;
    this.webServerPort = webServerPort;

    // Initialize user context service
    const userRepository = createUserRepository();
    const permissionChecker = createPermissionChecker();
    this.userContextService = createUserContextService(
      userRepository,
      permissionChecker
    );

    this.server = new Server(
      {
        name: 'the-agency-hq',
        version: '2.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private notifyDashboard(event: DashboardEvent) {
    const data = JSON.stringify(event);
    console.error(`[MCP] -> UI Event: ${event.type} (${event.agentName || 'System'})`);

    const req = http.request({
      hostname: '127.0.0.1',
      port: this.webServerPort,
      path: '/api/internal/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    });

    req.on('error', (err) => {
      console.error(
        `[MCP] Relaying to Dashboard failed: ${err.message}. Ensure Web Server is running on port ${this.webServerPort}`
      );
    });

    req.write(data);
    req.end();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const activeIds = this.store.getActiveIds();
      const resources = [
        {
          uri: 'agency://company/handbook',
          name: '公司核心成员手册',
          description: '当前入职的所有 AI 专家的详细画像和技能描述',
          mimeType: 'text/markdown',
        },
        ...activeIds.map((id) => {
          const agent = this.scanner.getAgent(id);
          return {
            uri: `agency://agents/${id}`,
            name: agent?.frontmatter.name || id,
            description: agent?.frontmatter.description || '',
            mimeType: 'text/markdown',
          };
        }),
      ].filter((resource) => resource.name);

      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (request.params.uri === 'agency://company/handbook') {
        const activeIds = this.store.getActiveIds();
        let handbook = '# 核心成员手册\n\n当前公司在职专家列表：\n\n';

        for (const id of activeIds) {
          const agent = this.scanner.getAgent(id);
          if (!agent) {
            continue;
          }

          handbook += `## ${agent.frontmatter.name}\n- 职责: ${agent.frontmatter.description}\n\n`;
        }

        return {
          contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text: handbook }],
        };
      }

      const match = request.params.uri.match(/^agency:\/\/agents\/([^/]+)$/);
      if (!match) {
        throw new McpError(ErrorCode.InvalidRequest, 'Invalid URI');
      }

      const id = match[1];
      const agent = this.scanner.getAgent(id);
      if (!agent) {
        throw new McpError(ErrorCode.InvalidRequest, 'Agent not found');
      }

      return {
        contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text: agent.content }],
      };
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'consult_the_agency',
            description: '统一专家门户。自动寻找最合适的专家，必要时完成入职后再分配任务。',
            inputSchema: {
              type: 'object',
              properties: {
                task: { type: 'string', description: '需要专家处理的任务或问题' },
                user_id: { type: 'string', description: '用户ID（可选，用于权限过滤）' },
              },
              required: ['task'],
            },
          },
          {
            name: 'find_experts',
            description: '根据主题或任务搜索最相关的专家候选人，返回匹配排序结果。',
            inputSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: '需要寻找专家的主题或任务' },
                max_experts: {
                  type: 'number',
                  description: '最多返回几位专家，默认 4，范围 1-8',
                },
                user_id: { type: 'string', description: '用户ID（可选，用于权限过滤）' },
              },
              required: ['topic'],
            },
          },
          {
            name: 'manage_staff',
            description: '公司人事管理系统。支持招聘(hire)或解雇(fire)单个员工。',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['hire', 'fire'], description: '执行的操作' },
                agent_query: { type: 'string', description: '员工名称或角色关键字' },
              },
              required: ['action', 'agent_query'],
            },
          },
          {
            name: 'hire_experts',
            description: '批量招聘专家。适合先搜索候选人，再将多位专家一并入职。',
            inputSchema: {
              type: 'object',
              properties: {
                agent_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '需要招聘的专家 ID 列表',
                },
              },
              required: ['agent_ids'],
            },
          },
          {
            name: 'assign_expert_tasks',
            description: '给指定专家分配真实任务，逐个触发独立回复并返回结果。',
            inputSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: '要讨论或处理的主题' },
                agent_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '要执行任务的专家 ID 列表',
                },
                execution_mode: {
                  type: 'string',
                  enum: ['auto', 'force_serial', 'require_sampling'],
                  description: '执行模式：自动/强制串行/必须并行(sampling)',
                },
              },
              required: ['topic', 'agent_ids'],
            },
          },
          {
            name: 'report_task_result',
            description: '记录任务执行结果到公司知识库。当专家完成一项重要任务后，请使用此工具记录经验。',
            inputSchema: {
              type: 'object',
              properties: {
                task: { type: 'string', description: '原始任务描述' },
                agent_id: { type: 'string', description: '执行任务的专家 ID' },
                result_summary: { type: 'string', description: '任务执行的结果摘要或关键经验' },
              },
              required: ['task', 'agent_id', 'result_summary'],
            },
          },
          {
            name: 'expert_discussion',
            description: '组织真正的专家讨论：自动找人、必要时招聘、逐个分配任务、最后汇总结论。',
            inputSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: '讨论主题或问题' },
                participant_count: {
                  type: 'number',
                  description: '参与讨论的专家人数，默认 3，范围 2-4',
                },
                execution_mode: {
                  type: 'string',
                  enum: ['auto', 'force_serial', 'require_sampling'],
                  description: '执行模式：自动/强制串行/必须并行(sampling)',
                },
                user_id: { type: 'string', description: '用户ID（可选，用于权限过滤）' },
              },
              required: ['topic'],
            },
          },
          {
            name: 'get_session_capabilities',
            description: '查看当前会话能力与执行策略，包含 sampling 开关状态。',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'probe_sampling_runtime',
            description: '执行一次真实 sampling/createMessage 探测，区分握手支持与运行时支持。',
            inputSchema: { type: 'object', properties: {} },
          },
          ...this.store
            .getActiveIds()
            .map((id) => {
              const agent = this.scanner.getAgent(id);
              return {
                name: `consult_${id.replace(/-/g, '_')}`,
                description: `直接咨询 ${agent?.frontmatter.name}.`,
                inputSchema: {
                  type: 'object',
                  properties: { task: { type: 'string' } },
                  required: ['task'],
                },
              };
            })
            .filter((tool) => tool.name),
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const userId = args?.user_id as string | undefined;

      if (name === 'find_experts') {
        return this.handleFindExperts(args?.topic as string, args?.max_experts as number | undefined, userId);
      }

      if (name === 'manage_staff') {
        return this.handleRecruitment(args?.action as string, args?.agent_query as string);
      }

      if (name === 'hire_experts') {
        return this.handleBatchHire(args?.agent_ids as string[] | undefined);
      }

      if (name === 'consult_the_agency') {
        return this.handleSmartRouting(args?.task as string, userId);
      }

      if (name === 'assign_expert_tasks') {
        return this.handleAssignExpertTasks(
          args?.topic as string,
          args?.agent_ids as string[] | undefined,
          args?.execution_mode
        );
      }

      if (name === 'report_task_result') {
        await this.store.saveKnowledge({
          task: args?.task as string,
          agentId: args?.agent_id as string,
          resultSummary: args?.result_summary as string,
        });
        return { content: [{ type: 'text', text: '✅ 任务经验已存入公司知识库。' }] };
      }

      if (name === 'expert_discussion') {
        return this.handleExpertDiscussion(
          args?.topic as string,
          args?.participant_count as number | undefined,
          args?.execution_mode,
          userId
        );
      }

      if (name === 'get_session_capabilities') {
        return this.handleGetSessionCapabilities();
      }

      if (name === 'probe_sampling_runtime') {
        return this.handleProbeSamplingRuntime();
      }

      if (name.startsWith('consult_')) {
        const id = name.replace('consult_', '').replace(/_/g, '-');
        return this.executeAgentTask(id, args?.task as string);
      }

      throw new McpError(ErrorCode.MethodNotFound, 'Unknown tool');
    });
  }

  private getSamplingPolicy(): 'client' | 'force_on' | 'force_off' {
    const raw = (process.env.AGENCY_MCP_SAMPLING_POLICY || 'client').toLowerCase();
    if (raw === 'force_on' || raw === 'force_off' || raw === 'client') {
      return raw;
    }
    return 'client';
  }

  private getFeatures(text: string): Map<string, number> {
    const features = new Map<string, number>();
    const words = text
      .toLowerCase()
      .split(/[\s,，.。!！?？\-_/:()]+/)
      .filter((token) => token.length > 0);

    for (const word of words) {
      features.set(word, (features.get(word) || 0) + 1);
    }

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (/[\u4e00-\u9fa5]/.test(char)) {
        features.set(char, (features.get(char) || 0) + 1);
      }
    }

    return features;
  }

  private calculateSmartScore(agent: Agent, task: string): number {
    const taskFeatures = this.getFeatures(task);
    const nameFeatures = this.getFeatures(agent.frontmatter.name);
    const descFeatures = this.getFeatures(agent.frontmatter.description);
    const idFeatures = this.getFeatures(agent.id);

    let score = 0;
    taskFeatures.forEach((count, feature) => {
      if (nameFeatures.has(feature)) {
        score += count * nameFeatures.get(feature)! * 10;
      }
      if (idFeatures.has(feature)) {
        score += count * idFeatures.get(feature)! * 8;
      }
      if (descFeatures.has(feature)) {
        score += count * descFeatures.get(feature)! * 2;
      }
    });

    return score;
  }

  private rankExperts(topic: string, maxExperts: number = 4, userId?: string): RankedExpert[] {
    const activeIds = new Set(this.store.getActiveIds());

    // Filter agents by user context
    const allAgents = this.scanner.getAllAgents();
    const filteredAgents = this.userContextService.filterAgentsByUser(allAgents, userId);

    const ranked = filteredAgents
      .map((agent) => ({
        agent,
        score: this.calculateSmartScore(agent, topic),
        isActive: activeIds.has(agent.id),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }
        return left.agent.frontmatter.name.localeCompare(right.agent.frontmatter.name);
      });

    const capped = Math.min(Math.max(maxExperts, 1), 8);
    const meaningful = ranked.filter((entry) => entry.score > 0).slice(0, capped);
    if (meaningful.length > 0) {
      if (meaningful.length >= capped) {
        return meaningful;
      }

      const selectedIds = new Set(meaningful.map((entry) => entry.agent.id));
      const fillers = ranked
        .filter((entry) => !selectedIds.has(entry.agent.id))
        .slice(0, capped - meaningful.length);
      return [...meaningful, ...fillers];
    }

    return ranked.slice(0, capped);
  }

  private findAgentByQuery(query: string): RankedExpert | null {
    const ranked = this.rankExperts(query, 8);
    const loweredQuery = query.toLowerCase();

    const directHit = ranked.find(
      (entry) =>
        entry.agent.id.includes(loweredQuery) ||
        entry.agent.frontmatter.name.toLowerCase().includes(loweredQuery) ||
        entry.agent.frontmatter.description.toLowerCase().includes(loweredQuery)
    );

    return directHit || ranked[0] || null;
  }

  private hireAgents(agentIds: string[]): { hired: Agent[]; alreadyActive: Agent[]; missing: string[] } {
    const uniqueIds = Array.from(new Set(agentIds));
    const activeIds = new Set(this.store.getActiveIds());
    const nextActiveIds = new Set(activeIds);
    const hired: Agent[] = [];
    const alreadyActive: Agent[] = [];
    const missing: string[] = [];

    for (const agentId of uniqueIds) {
      const agent = this.scanner.getAgent(agentId);
      if (!agent) {
        missing.push(agentId);
        continue;
      }

      if (activeIds.has(agentId)) {
        alreadyActive.push(agent);
        continue;
      }

      nextActiveIds.add(agentId);
      hired.push(agent);
    }

    if (hired.length > 0) {
      this.store.save(Array.from(nextActiveIds));
      for (const agent of hired) {
        this.notifyDashboard({ type: 'AGENT_HIRED', agentId: agent.id, agentName: agent.frontmatter.name });
      }
    }

    return { hired, alreadyActive, missing };
  }

  private async buildKnowledgeContext(task: string): Promise<string> {
    const history = await this.store.searchKnowledge(task);
    if (history.length === 0) {
      return '';
    }

    return (
      '\n\n---\n### 相关历史经验参考：\n' +
      history
        .map((entry, index) => {
          const expert = this.scanner.getAgent(entry.agentId);
          const expertName = expert?.frontmatter.name || entry.agentId;
          return `${index + 1}. 【任务】: ${entry.task}\n   【专家】: ${expertName}\n   【结果】: ${entry.resultSummary}`;
        })
        .join('\n')
    );
  }

  private buildExpertAssignment(topic: string, participant: RankedExpert, participants: RankedExpert[]): string {
    const peerSummary = participants
      .map((entry) => `- ${entry.agent.frontmatter.name}: ${entry.agent.frontmatter.description}`)
      .join('\n');

    return [
      `主题：${topic}`,
      '',
      `你当前扮演的专家：${participant.agent.frontmatter.name}`,
      `你的职责：${participant.agent.frontmatter.description}`,
      '',
      '当前讨论阵容：',
      peerSummary,
      '',
      '请独立完成以下任务：',
      '1. 从你的专业角度给出核心判断。',
      '2. 指出你最关注的风险或约束。',
      '3. 提出 2-4 条可执行建议。',
      '4. 说明你希望其他专家补充回答的一个问题。',
      '',
      '请使用清晰的小标题输出，重点保持专业、具体、可执行。',
    ].join('\n');
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (content && typeof content === 'object' && 'type' in content) {
      const maybeText = content as { type?: string; text?: string };
      if (maybeText.type === 'text' && typeof maybeText.text === 'string') {
        return maybeText.text;
      }
    }

    return JSON.stringify(content, null, 2);
  }

  private getSessionCapabilities(): SessionCapabilities {
    const capabilities = this.server.getClientCapabilities() as { sampling?: unknown } | undefined;
    const policy = this.getSamplingPolicy();
    const clientSampling = Boolean(capabilities?.sampling);
    const sampling =
      policy === 'force_on' ? true : policy === 'force_off' ? false : clientSampling;
    return {
      ...defaultSessionCapabilities(),
      sampling,
    };
  }

  private formatExecutionBlockedMessage(decision: ExecutionDecision): string {
    if (!decision.error) {
      return '当前执行模式不可用。';
    }

    const actionLines = decision.error.actions
      .map((action, index) => `${index + 1}. ${action.label}：${action.description}`)
      .join('\n');

    return [
      `原因：${decision.error.reason}`,
      `影响：${decision.error.impact}`,
      '可选动作：',
      actionLines,
    ].join('\n');
  }

  private extractToolText(toolResult: unknown): string {
    if (typeof toolResult !== 'object' || !toolResult || !('content' in toolResult)) {
      return '';
    }

    const content = (toolResult as { content?: Array<{ type?: string; text?: string }> }).content;
    if (!Array.isArray(content)) {
      return '';
    }

    const textItem = content.find((entry) => entry.type === 'text' && typeof entry.text === 'string');
    return textItem?.text || '';
  }

  private async generateSerialConsultResponse(agent: Agent, assignment: string): Promise<string> {
    const result = await this.executeAgentTask(agent.id, assignment);
    const text = this.extractToolText(result);
    return text || `【专家建议来自：${agent.frontmatter.name}】\n\n${assignment}`;
  }

  private synthesizeFallbackDiscussion(topic: string, expertResponses: ExpertResponse[]): string {
    const bullet = expertResponses
      .map(({ participant }, index) => `${index + 1}. ${participant.agent.frontmatter.name}`)
      .join('\n');
    return [
      `本次讨论主题：${topic}`,
      '',
      '当前会话不支持 sampling，已自动降级为串行咨询并返回每位专家的独立建议。',
      '建议你重点查看“各专家独立回复”，由业务负责人进行最终决策汇总。',
      '',
      '本轮参与专家：',
      bullet,
    ].join('\n');
  }

  private async sampleExpertResponse(agent: Agent, assignment: string): Promise<string> {
    const knowledgeContext = await this.buildKnowledgeContext(assignment);
    const response = await this.server.createMessage({
      systemPrompt: `${agent.systemPrompt}\n\n请始终以该专家身份完成分析，避免跳出角色。`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${assignment}${knowledgeContext}`,
          },
        },
      ],
      maxTokens: 1200,
    });

    return this.extractTextContent(response.content);
  }

  private async synthesizeDiscussion(topic: string, expertResponses: ExpertResponse[]): Promise<string> {
    const compiledResponses = expertResponses
      .map(
        ({ participant, response }, index) =>
          `## 专家 ${index + 1}: ${participant.agent.frontmatter.name}\n${response}`
      )
      .join('\n\n');

    const response = await this.server.createMessage({
      systemPrompt:
        '你是 The Agency HQ 的主持人。请综合多位专家观点，形成统一结论，不要虚构未出现的信息。',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `讨论主题：${topic}`,
              '',
              '以下是各位专家的真实独立回复，请输出：',
              '1. 共识',
              '2. 分歧',
              '3. 推荐行动方案',
              '4. 建议的下一步负责人',
              '',
              compiledResponses,
            ].join('\n'),
          },
        },
      ],
      maxTokens: 1200,
    });

    return this.extractTextContent(response.content);
  }

  private async executeAssignedParticipants(
    topic: string,
    participants: DiscussionParticipant[],
    decision: ExecutionDecision
  ): Promise<ExpertResponse[]> {
    const responses: ExpertResponse[] = [];
    for (const participant of participants) {
      this.notifyDashboard({
        type: 'AGENT_ASSIGNED',
        agentId: participant.agent.id,
        agentName: participant.agent.frontmatter.name,
        task: participant.assignment,
        topic,
      });
      this.notifyDashboard({
        type: 'AGENT_WORKING',
        agentId: participant.agent.id,
        agentName: participant.agent.frontmatter.name,
        task: participant.assignment,
        topic,
      });

      const response =
        decision.appliedMode === 'parallel'
          ? await this.sampleExpertResponse(participant.agent, participant.assignment)
          : await this.generateSerialConsultResponse(participant.agent, participant.assignment);
      responses.push({ participant, response });

      this.notifyDashboard({
        type: 'AGENT_TASK_COMPLETED',
        agentId: participant.agent.id,
        agentName: participant.agent.frontmatter.name,
        task: topic,
      });
    }

    return responses;
  }

  private selectDiscussionParticipants(topic: string, requestedCount?: number, userId?: string): DiscussionParticipant[] {
    const participantCount = Math.min(Math.max(requestedCount ?? 3, 2), 4);
    const ranked = this.rankExperts(topic, participantCount, userId);
    const baseline = ranked.length >= 2 ? ranked : this.rankExperts(topic, 2, userId);

    return baseline.slice(0, participantCount).map((entry, _index, allEntries) => ({
      ...entry,
      hiredForTask: !entry.isActive,
      assignment: this.buildExpertAssignment(topic, entry, allEntries),
    }));
  }

  private async handleFindExperts(topic: string, requestedCount?: number, userId?: string) {
    if (!topic) {
      throw new McpError(ErrorCode.InvalidParams, 'topic is required');
    }

    const ranked = this.rankExperts(topic, requestedCount ?? 4, userId);
    const lines = ranked.map(
      (entry, index) =>
        `${index + 1}. ${entry.agent.frontmatter.name} (\`${entry.agent.id}\`)${entry.isActive ? ' [在职]' : ' [候选]'}\n   匹配分: ${entry.score}\n   职责: ${entry.agent.frontmatter.description}`
    );

    return {
      content: [
        {
          type: 'text',
          text: `# 专家搜索结果\n\n主题：${topic}\n\n${lines.join('\n\n')}`,
        },
      ],
    };
  }

  private async handleRecruitment(action: string, query: string) {
    const match = this.findAgentByQuery(query);
    if (!match) {
      return { content: [{ type: 'text', text: `❌ 找不到匹配 "${query}" 的专家。` }] };
    }

    if (action === 'hire') {
      const result = this.hireAgents([match.agent.id]);
      if (result.missing.length > 0) {
        return { content: [{ type: 'text', text: `❌ 找不到专家：${result.missing.join(', ')}` }] };
      }
      if (result.alreadyActive.length > 0) {
        return { content: [{ type: 'text', text: `ℹ️ ${match.agent.frontmatter.name} 已经入职了。` }] };
      }
      return { content: [{ type: 'text', text: `✅ 招聘成功！${match.agent.frontmatter.name} 已正式入职。` }] };
    }

    const activeIds = this.store.getActiveIds();
    if (!activeIds.includes(match.agent.id)) {
      return { content: [{ type: 'text', text: `ℹ️ ${match.agent.frontmatter.name} 当前并不在职。` }] };
    }

    this.store.save(activeIds.filter((id) => id !== match.agent.id));
    this.notifyDashboard({ type: 'AGENT_FIRED', agentId: match.agent.id, agentName: match.agent.frontmatter.name });
    return { content: [{ type: 'text', text: `👋 合作愉快。${match.agent.frontmatter.name} 已从公司离职。` }] };
  }

  private async handleBatchHire(agentIds?: string[]) {
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'agent_ids must be a non-empty array');
    }

    const result = this.hireAgents(agentIds);
    const lines: string[] = [];

    if (result.hired.length > 0) {
      lines.push(`已入职：${result.hired.map((agent) => `${agent.frontmatter.name}(\`${agent.id}\`)`).join(', ')}`);
    }
    if (result.alreadyActive.length > 0) {
      lines.push(
        `已在职：${result.alreadyActive.map((agent) => `${agent.frontmatter.name}(\`${agent.id}\`)`).join(', ')}`
      );
    }
    if (result.missing.length > 0) {
      lines.push(`未找到：${result.missing.join(', ')}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `# 批量招聘结果\n\n${lines.join('\n') || '没有发生任何变更。'}`,
        },
      ],
    };
  }

  private async handleSmartRouting(task: string, userId?: string) {
    if (!task) {
      throw new McpError(ErrorCode.InvalidParams, 'task is required');
    }

    const [bestMatch] = this.rankExperts(task, 1, userId);
    if (!bestMatch) {
      return {
        content: [{ type: 'text', text: '❌ 公司目前没有可用专家。' }],
      };
    }

    let autoHireNotice = '';
    if (!bestMatch.isActive) {
      const result = this.hireAgents([bestMatch.agent.id]);
      if (result.hired.length > 0) {
        autoHireNotice = `已自动招聘：${bestMatch.agent.frontmatter.name}。\n\n`;
      }
    }

    const expertResult = await this.executeAgentTask(bestMatch.agent.id, task);
    const originalText = expertResult.content[0]?.type === 'text' ? expertResult.content[0].text : '';

    return {
      content: [
        {
          type: 'text',
          text: `${autoHireNotice}${originalText}`.trim(),
        },
      ],
    };
  }

  private async executeAgentTask(agentId: string, task: string) {
    const agent = this.scanner.getAgent(agentId);
    if (!agent) {
      throw new McpError(ErrorCode.InvalidRequest, 'Expert not found.');
    }

    const historyContext = await this.buildKnowledgeContext(task);
    this.notifyDashboard({ type: 'AGENT_WORKING', agentId: agent.id, agentName: agent.frontmatter.name, task });

    return {
      content: [
        {
          type: 'text',
          text: `【专家建议来自：${agent.frontmatter.name}】\n\n${agent.systemPrompt}${historyContext}\n\n---\n任务：${task}`,
        },
      ],
    };
  }

  private async handleAssignExpertTasks(topic: string, agentIds?: string[], requestedModeRaw?: unknown) {
    if (!topic) {
      throw new McpError(ErrorCode.InvalidParams, 'topic is required');
    }
    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'agent_ids must be a non-empty array');
    }

    const hiredResult = this.hireAgents(agentIds);
    const rankedParticipants: RankedExpert[] = [];
    for (const agentId of agentIds) {
      const agent = this.scanner.getAgent(agentId);
      if (!agent) {
        continue;
      }

      rankedParticipants.push({
        agent,
        score: this.calculateSmartScore(agent, topic),
        isActive: true,
      });
    }

    const participants: DiscussionParticipant[] = rankedParticipants.map((entry, _index, allEntries) => ({
      ...entry,
      hiredForTask: hiredResult.hired.some((agent) => agent.id === entry.agent.id),
      assignment: this.buildExpertAssignment(topic, entry, allEntries),
    }));

    const requestedMode = normalizeExecutionMode(requestedModeRaw);
    const decision = resolveExecutionDecision(this.getSessionCapabilities(), requestedMode);
    if (decision.blocked) {
      throw new McpError(ErrorCode.InvalidRequest, this.formatExecutionBlockedMessage(decision));
    }

    const responses = await this.executeAssignedParticipants(topic, participants, decision);

    const responseText = responses
      .map(
        ({ participant, response }, index) =>
          `## ${index + 1}. ${participant.agent.frontmatter.name}\n分配任务：${participant.assignment}\n\n${response}`
      )
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `# 专家任务执行结果\n\n主题：${topic}\n\n## 执行模式\n- 请求模式：${decision.requestedMode}\n- 实际模式：${decision.appliedMode}\n- 自动降级：${
            decision.degraded ? '是' : '否'
          }\n${decision.notice ? `- 提示：${decision.notice}\n` : ''}\n## 本次入职\n${
            hiredResult.hired.length > 0
              ? hiredResult.hired.map((agent) => `- ${agent.frontmatter.name} (\`${agent.id}\`)`).join('\n')
              : '- 无新增入职'
          }\n\n${responseText}`,
        },
      ],
    };
  }

  private async handleExpertDiscussion(topic: string, requestedCount?: number, requestedModeRaw?: unknown, userId?: string) {
    if (!topic) {
      throw new McpError(ErrorCode.InvalidParams, 'topic is required');
    }

    const requestedMode = normalizeExecutionMode(requestedModeRaw);
    const decision = resolveExecutionDecision(this.getSessionCapabilities(), requestedMode);
    if (decision.blocked) {
      throw new McpError(ErrorCode.InvalidRequest, this.formatExecutionBlockedMessage(decision));
    }

    const participants = this.selectDiscussionParticipants(topic, requestedCount, userId);
    if (participants.length < 2) {
      return {
        content: [{ type: 'text', text: '❌ 没有足够的专家来组织讨论。' }],
      };
    }

    const hiredResult = this.hireAgents(
      participants.filter((participant) => participant.hiredForTask).map((participant) => participant.agent.id)
    );

    this.notifyDashboard({
      type: 'DISCUSSION_STARTED',
      topic,
      participantCount: participants.length,
      participants: participants.map((participant) => ({
        id: participant.agent.id,
        name: participant.agent.frontmatter.name,
      })),
      hiredAgentIds: hiredResult.hired.map((agent) => agent.id),
    });

    const expertResponses = await this.executeAssignedParticipants(topic, participants, decision);
    const synthesis =
      decision.appliedMode === 'parallel'
        ? await this.synthesizeDiscussion(topic, expertResponses)
        : this.synthesizeFallbackDiscussion(topic, expertResponses);

    this.notifyDashboard({
      type: 'DISCUSSION_COMPLETED',
      topic,
      participantCount: participants.length,
      participants: participants.map((participant) => ({
        id: participant.agent.id,
        name: participant.agent.frontmatter.name,
      })),
    });

    const participantLines = participants
      .map((participant, index) => {
        const status = participant.hiredForTask ? '本次新入职' : '原在职';
        return `${index + 1}. ${participant.agent.frontmatter.name} (\`${participant.agent.id}\`) - ${status}\n   方向：${participant.agent.frontmatter.description}`;
      })
      .join('\n\n');

    const responseSections = expertResponses
      .map(
        ({ participant, response }, index) =>
          `## 专家 ${index + 1}: ${participant.agent.frontmatter.name}\n### 分配任务\n${participant.assignment}\n\n### 独立回复\n${response}`
      )
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text',
          text: [
            `# 专家讨论：${topic}`,
            '',
            '## 执行模式',
            `- 请求模式：${decision.requestedMode}`,
            `- 实际模式：${decision.appliedMode}`,
            `- 自动降级：${decision.degraded ? '是' : '否'}`,
            ...(decision.notice ? [`- 提示：${decision.notice}`] : []),
            '',
            '## 执行流程',
            '1. 搜索相关专家',
            '2. 自动招聘未在职但高匹配的专家',
            '3. 给每位专家单独分配任务并获取真实独立回复',
            '4. 汇总形成最终建议',
            '',
            '## 参与专家',
            participantLines,
            '',
            '## 各专家独立回复',
            responseSections,
            '',
            '## 综合结论',
            synthesis,
          ].join('\n'),
        },
      ],
    };
  }

  private async handleGetSessionCapabilities() {
    const capabilities = this.getSessionCapabilities();
    const policy = this.getSamplingPolicy();
    return {
      content: [
        {
          type: 'text',
          text: [
            '# 会话能力',
            '',
            `- sampling: ${capabilities.sampling ? 'on' : 'off'}`,
            `- sampling_policy: ${policy}`,
            '- execution_mode: auto | force_serial | require_sampling',
            '',
            capabilities.sampling
              ? '当前会话支持 sampling，可按需执行并行模式。'
              : '当前会话不支持 sampling，建议使用 auto（自动降级串行）避免硬失败。',
            '',
            policy === 'client'
              ? '说明：sampling 状态跟随 MCP 客户端（如 Codex/Claude Code）声明能力。'
              : '说明：sampling 状态由网关策略强制覆盖（用于灰度/实验开关）。',
          ].join('\n'),
        },
      ],
    };
  }

  private async handleProbeSamplingRuntime() {
    const capabilities = this.getSessionCapabilities();
    const policy = this.getSamplingPolicy();

    try {
      const response = await this.server.createMessage({
        systemPrompt: 'You are a diagnostic assistant. Reply with exactly one short token: OK.',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Runtime sampling probe. Reply with OK only.',
            },
          },
        ],
        maxTokens: 24,
      });

      const output = this.extractTextContent(response.content).trim();
      return {
        content: [
          {
            type: 'text',
            text: [
              '# Sampling Runtime Probe',
              '',
              '## 结果',
              '- runtime_sampling: available',
              `- sampling: ${capabilities.sampling ? 'on' : 'off'}`,
              `- sampling_policy: ${policy}`,
              `- sample_output: ${output || '(empty)'}`,
              '',
              '## 结论',
              '当前会话不仅握手可见，而且 runtime createMessage 调用可用，可执行真实采样路径。',
            ].join('\n'),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const likelyCapabilityMismatch =
        message.toLowerCase().includes('sampling') && message.toLowerCase().includes('capability');

      return {
        content: [
          {
            type: 'text',
            text: [
              '# Sampling Runtime Probe',
              '',
              '## 结果',
              '- runtime_sampling: unavailable',
              `- sampling: ${capabilities.sampling ? 'on' : 'off'}`,
              `- sampling_policy: ${policy}`,
              `- error: ${message}`,
              '',
              '## 诊断',
              likelyCapabilityMismatch
                ? '客户端未在 runtime 提供 sampling/createMessage 能力，或能力声明与实现不一致。'
                : 'runtime 采样调用失败，可能是客户端拒绝、策略拦截或执行层异常。',
              '',
              '## 建议动作',
              '1. 运行 `get_session_capabilities` 检查握手状态。',
              '2. 若 `sampling_policy=client` 且 `sampling=off`，切换支持 sampling 的客户端。',
              '3. 若需不中断结果，使用 `execution_mode=auto` 自动降级串行执行。',
            ].join('\n'),
          },
        ],
      };
    }
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agency HQ MCP Server v2.1 running on stdio');
  }
}
