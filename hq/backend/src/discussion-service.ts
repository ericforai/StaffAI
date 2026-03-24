import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Scanner } from './scanner';
import { Store } from './store';
import { Agent } from './types';

const execFileAsync = promisify(execFile);
const CLAUDE_CLI_PATH = process.env.AGENCY_DISCUSSION_CLAUDE_PATH || '/Users/user/.nvm/versions/node/v22.16.0/bin/claude';
const CODEX_CLI_PATH = process.env.AGENCY_DISCUSSION_CODEX_PATH || '/Users/user/.nvm/versions/node/v22.16.0/bin/codex';
const STRUCTURED_RESPONSE_SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  properties: {
    response: {
      type: 'string',
    },
  },
  required: ['response'],
});

export interface DashboardEvent {
  type: string;
  activeAgentIds?: string[];
  agentId?: string;
  agentName?: string;
  task?: string;
  topic?: string;
  tool?: 'consult_the_agency' | 'expert_discussion';
  stage?: string;
  message?: string;
  progress?: number;
  status?: 'started' | 'running' | 'completed' | 'failed';
  executor?: ExecutorName;
  participantCount?: number;
  participants?: Array<{ id: string; name: string }>;
  hiredAgentIds?: string[];
}

export interface ExpertCandidate {
  id: string;
  name: string;
  description: string;
  department: string;
  score: number;
  isActive: boolean;
}

export interface DiscussionParticipant extends ExpertCandidate {
  hiredForTask: boolean;
  assignment: string;
  response?: string;
}

export interface AgencyConsultResult {
  task: string;
  expert: ExpertCandidate;
  response: string;
  executor: ExecutorName;
  autoHired: boolean;
}

export interface DiscussionRunResult {
  topic: string;
  participants: DiscussionParticipant[];
  synthesis: string;
  executor: ExecutorName;
}

export interface ExecutorCheck {
  name: ExecutorName;
  configured: boolean;
  available: boolean;
  status: 'ready' | 'missing' | 'disabled';
  detail: string;
}

export interface StartupCheckResult {
  preferredExecutor: ExecutorPreference;
  effectiveDefaultExecutor: ExecutorName;
  discussionTimeoutMs: number;
  overallReady: boolean;
  checks: ExecutorCheck[];
}

type EventPublisher = (event: DashboardEvent) => void;
export type ExecutorName = 'codex' | 'claude' | 'openai';
type ExecutorPreference = 'auto' | ExecutorName;

interface RankedExpert {
  agent: Agent;
  score: number;
  isActive: boolean;
}

export class DiscussionService {
  private scanner: Scanner;
  private store: Store;
  private publish: EventPublisher;
  private workspaceRoot: string;

  constructor(scanner: Scanner, store: Store, publish: EventPublisher) {
    this.scanner = scanner;
    this.store = store;
    this.publish = publish;
    this.workspaceRoot = path.resolve(__dirname, '../../..');
  }

  public searchExperts(topic: string, requestedCount: number = 4): ExpertCandidate[] {
    const ranked = this.rankExperts(topic, requestedCount);
    return ranked.map((entry) => this.toCandidate(entry.agent, entry.score, entry.isActive));
  }

  public async consultTheAgency(task: string): Promise<AgencyConsultResult> {
    this.publishToolProgress('consult_the_agency', 'matching-expert', 'started', 8, '正在匹配最合适的顾问');
    const [bestMatch] = this.rankExperts(task, 1);
    if (!bestMatch) {
      throw new Error('公司目前没有可用专家。');
    }

    const wasActive = bestMatch.isActive;
    if (!wasActive) {
      this.publishToolProgress(
        'consult_the_agency',
        'hiring-expert',
        'running',
        24,
        `正在让 ${bestMatch.agent.frontmatter.name} 入职`
      );
      this.hireExperts([bestMatch.agent.id]);
    }

    const assignment = [
      `任务：${task}`,
      '',
      `你当前扮演的专家：${bestMatch.agent.frontmatter.name}`,
      `你的职责：${bestMatch.agent.frontmatter.description}`,
      '',
      '请直接给出最重要的专业建议，重点覆盖：',
      '1. 你的核心判断',
      '2. 最值得优先处理的风险',
      '3. 接下来 2-4 条最重要的行动建议',
    ].join('\n');

    this.publish({
      type: 'AGENT_WORKING',
      agentId: bestMatch.agent.id,
      agentName: bestMatch.agent.frontmatter.name,
      task,
    });
    this.publishToolProgress(
      'consult_the_agency',
      'executing-expert',
      'running',
      62,
      `${bestMatch.agent.frontmatter.name} 正在给出建议`
    );

    const reply = await this.generateExpertReply(bestMatch.agent, assignment);

    this.publish({
      type: 'AGENT_TASK_COMPLETED',
      agentId: bestMatch.agent.id,
      agentName: bestMatch.agent.frontmatter.name,
      task,
    });
    this.publishToolProgress(
      'consult_the_agency',
      'completed',
      'completed',
      100,
      `${bestMatch.agent.frontmatter.name} 已提交建议`,
      reply.executor
    );

    return {
      task,
      expert: this.toCandidate(bestMatch.agent, bestMatch.score, true),
      response: reply.text,
      executor: reply.executor,
      autoHired: !wasActive,
    };
  }

  public hireExperts(agentIds: string[]) {
    const uniqueIds = Array.from(new Set(agentIds));
    const activeIds = new Set(this.store.getActiveIds());
    const nextActiveIds = new Set(activeIds);
    const hired: ExpertCandidate[] = [];
    const alreadyActive: ExpertCandidate[] = [];
    const missing: string[] = [];

    for (const agentId of uniqueIds) {
      const agent = this.scanner.getAgent(agentId);
      if (!agent) {
        missing.push(agentId);
        continue;
      }

      const candidate = this.toCandidate(agent, 0, true);
      if (activeIds.has(agentId)) {
        alreadyActive.push(candidate);
        continue;
      }

      nextActiveIds.add(agentId);
      hired.push(candidate);
    }

    if (hired.length > 0) {
      this.store.save(Array.from(nextActiveIds));
      for (const expert of hired) {
        this.publish({ type: 'AGENT_HIRED', agentId: expert.id, agentName: expert.name });
      }
    }

    return { hired, alreadyActive, missing };
  }

  public prepareDiscussion(topic: string, requestedCount: number = 3, agentIds?: string[]): DiscussionParticipant[] {
    const selectedIds = Array.isArray(agentIds) && agentIds.length > 0 ? agentIds : null;
    const activeIdSet = new Set(this.store.getActiveIds());
    const candidates = selectedIds
      ? selectedIds
          .map((agentId) => {
            const agent = this.scanner.getAgent(agentId);
            if (!agent) {
              return null;
            }
            return {
              agent,
              score: this.calculateSmartScore(agent, topic),
              isActive: activeIdSet.has(agentId),
            };
          })
          .filter((entry): entry is RankedExpert => entry !== null)
      : this.rankExperts(topic, requestedCount);

    return candidates.map((entry, _index, allEntries) => ({
      ...this.toCandidate(entry.agent, entry.score, entry.isActive),
      hiredForTask: !entry.isActive,
      assignment: this.buildExpertAssignment(topic, entry.agent, allEntries.map((item) => item.agent)),
    }));
  }

  public async runDiscussion(
    topic: string,
    requestedCount: number = 3,
    agentIds?: string[]
  ): Promise<DiscussionRunResult> {
    this.publishToolProgress('expert_discussion', 'preparing-squad', 'started', 5, '正在准备讨论阵容');
    const participants = this.prepareDiscussion(topic, requestedCount, agentIds);
    if (participants.length < 2) {
      throw new Error('没有足够的专家来组织讨论。');
    }

    if (participants.some((participant) => participant.hiredForTask)) {
      this.publishToolProgress('expert_discussion', 'hiring-experts', 'running', 16, '正在补齐讨论专家阵容');
    }
    const hireResult = this.hireExperts(
      participants.filter((participant) => participant.hiredForTask).map((participant) => participant.id)
    );

    this.publish({
      type: 'DISCUSSION_STARTED',
      topic,
      participantCount: participants.length,
      participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
      hiredAgentIds: hireResult.hired.map((participant) => participant.id),
    });
    this.publishToolProgress('expert_discussion', 'assigning-tasks', 'running', 28, '正在为每位专家分配独立任务');

    let executorUsed: ExecutorName | null = null;
    const completedParticipants: DiscussionParticipant[] = [];

    for (const [index, participant] of participants.entries()) {
      this.publish({
        type: 'AGENT_ASSIGNED',
        agentId: participant.id,
        agentName: participant.name,
        task: participant.assignment,
        topic,
      });
      this.publish({
        type: 'AGENT_WORKING',
        agentId: participant.id,
        agentName: participant.name,
        task: participant.assignment,
        topic,
      });
      const participantProgress = 35 + Math.round(((index + 1) / participants.length) * 40);
      this.publishToolProgress(
        'expert_discussion',
        'collecting-replies',
        'running',
        participantProgress,
        `${participant.name} 正在生成专家回复`
      );

      const agent = this.scanner.getAgent(participant.id);
      if (!agent) {
        continue;
      }

      const response = await this.generateExpertReply(agent, participant.assignment);
      executorUsed = response.executor;
      completedParticipants.push({ ...participant, response: response.text });

      this.publish({
        type: 'AGENT_TASK_COMPLETED',
        agentId: participant.id,
        agentName: participant.name,
        task: topic,
      });
    }

    this.publishToolProgress('expert_discussion', 'synthesizing', 'running', 84, '主持人正在综合专家意见');
    const synthesis = await this.synthesizeDiscussion(topic, completedParticipants);
    executorUsed = executorUsed ?? synthesis.executor;

    this.publish({
      type: 'DISCUSSION_COMPLETED',
      topic,
      participantCount: completedParticipants.length,
      participants: completedParticipants.map((participant) => ({ id: participant.id, name: participant.name })),
    });
    this.publishToolProgress(
      'expert_discussion',
      'completed',
      'completed',
      100,
      '讨论已完成，综合结论已生成',
      executorUsed ?? 'openai'
    );

    return {
      topic,
      participants: completedParticipants,
      synthesis: synthesis.text,
      executor: executorUsed ?? 'openai',
    };
  }

  public async getStartupCheck(): Promise<StartupCheckResult> {
    const preferredExecutor = this.getExecutorPreference();
    const claudeReady = await this.isExecutableAvailable(CLAUDE_CLI_PATH);
    const codexReady = await this.isExecutableAvailable(CODEX_CLI_PATH);
    const openAiReady = Boolean(process.env.OPENAI_API_KEY);
    const sandboxNetworkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1';

    const checks: ExecutorCheck[] = [
      {
        name: 'claude',
        configured: true,
        available: claudeReady,
        status: claudeReady ? 'ready' : 'missing',
        detail: claudeReady
          ? sandboxNetworkDisabled
            ? `Claude Code CLI 已就绪: ${CLAUDE_CLI_PATH}。检测到上游进程设置了 CODEX_SANDBOX_NETWORK_DISABLED=1，HQ 会在拉起子进程时主动清理该环境变量。`
            : `Claude Code CLI 已就绪: ${CLAUDE_CLI_PATH}`
          : `未找到 Claude Code CLI: ${CLAUDE_CLI_PATH}`,
      },
      {
        name: 'codex',
        configured: true,
        available: codexReady,
        status: codexReady ? 'ready' : 'missing',
        detail: codexReady
          ? sandboxNetworkDisabled
            ? `Codex CLI 已安装: ${CODEX_CLI_PATH}。检测到上游进程设置了 CODEX_SANDBOX_NETWORK_DISABLED=1，HQ 会在拉起子进程时主动清理该环境变量。`
            : `Codex CLI 已安装: ${CODEX_CLI_PATH}`
          : `未找到 Codex CLI: ${CODEX_CLI_PATH}`,
      },
      {
        name: 'openai',
        configured: openAiReady,
        available: openAiReady,
        status: openAiReady ? 'ready' : 'disabled',
        detail: openAiReady ? '已配置 OPENAI_API_KEY，可作为回退执行器。' : '未配置 OPENAI_API_KEY，云端回退已关闭。',
      },
    ];

    const effectiveDefaultExecutor =
      preferredExecutor === 'auto'
        ? claudeReady
          ? 'claude'
          : codexReady
            ? 'codex'
            : 'openai'
        : preferredExecutor;

    const overallReady = checks.some((check) => check.available);

    return {
      preferredExecutor,
      effectiveDefaultExecutor,
      discussionTimeoutMs: this.getDiscussionTimeoutMs(),
      overallReady,
      checks,
    };
  }

  private async generateExpertReply(agent: Agent, assignment: string): Promise<{ text: string; executor: ExecutorName }> {
    const prompt = `${assignment}${this.buildKnowledgeContext(assignment)}`;
    return this.generateText(agent.systemPrompt, prompt);
  }

  private async synthesizeDiscussion(
    topic: string,
    participants: DiscussionParticipant[]
  ): Promise<{ text: string; executor: ExecutorName }> {
    const compiled = participants
      .map(
        (participant, index) =>
          `## 专家 ${index + 1}: ${participant.name}\n${participant.response || '未返回结果'}`
      )
      .join('\n\n');

    const prompt = [
      `讨论主题：${topic}`,
      '',
      '请综合以下专家意见，输出：',
      '1. 共识',
      '2. 分歧',
      '3. 推荐行动方案',
      '4. 建议的下一步负责人',
      '',
      compiled,
    ].join('\n');

    return this.generateText(
      '你是 The Agency HQ 的主持人。请综合多位专家观点，形成统一结论，不要虚构未出现的信息。',
      prompt
    );
  }

  private async generateText(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ text: string; executor: ExecutorName }> {
    const preference = this.getExecutorPreference();
    const attempts = preference === 'auto' ? (['claude', 'codex', 'openai'] as ExecutorName[]) : [preference];
    const errors: string[] = [];

    for (const executor of attempts) {
      try {
        if (executor === 'codex') {
          return { text: await this.runCodex(systemPrompt, userPrompt), executor };
        }
        if (executor === 'claude') {
          return { text: await this.runClaude(systemPrompt, userPrompt), executor };
        }
        return { text: await this.runOpenAI(systemPrompt, userPrompt), executor };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${executor}: ${message}`);
      }
    }

    throw new Error(`没有可用的讨论执行器。尝试结果：${errors.join(' | ')}`);
  }

  private getExecutorPreference(): ExecutorPreference {
    const raw = (process.env.AGENCY_DISCUSSION_EXECUTOR || 'claude').toLowerCase();
    if (raw === 'codex' || raw === 'claude' || raw === 'openai') {
      return raw;
    }
    return 'claude';
  }

  private publishToolProgress(
    tool: 'consult_the_agency' | 'expert_discussion',
    stage: string,
    status: 'started' | 'running' | 'completed' | 'failed',
    progress: number,
    message: string,
    executor?: ExecutorName
  ) {
    this.publish({
      type: 'TOOL_PROGRESS',
      tool,
      stage,
      status,
      progress,
      message,
      executor,
    });
  }

  private getDiscussionTimeoutMs(): number {
    const raw = Number(process.env.AGENCY_DISCUSSION_TIMEOUT_MS || 240000);
    if (Number.isFinite(raw) && raw > 1000) {
      return raw;
    }
    return 240000;
  }

  private async ensureExecutable(executablePath: string, label: string): Promise<void> {
    try {
      await fs.access(executablePath);
    } catch {
      throw new Error(`${label} CLI 不可用: ${executablePath}`);
    }
  }

  private async isExecutableAvailable(executablePath: string): Promise<boolean> {
    try {
      await fs.access(executablePath);
      return true;
    } catch {
      return false;
    }
  }

  private buildExecutorEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.CODEX_SANDBOX_NETWORK_DISABLED;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    return env;
  }

  private getAgentPrompt(systemPrompt: string, userPrompt: string): string {
    return [
      '你是 The Agency HQ 为单个专家分配的独立执行代理。',
      '',
      '请严格按照下面的 system prompt 扮演该专家，并只返回专家自己的最终专业分析。',
      '不要解释你使用了什么工具，也不要输出额外前言。',
      '',
      '=== SYSTEM PROMPT ===',
      systemPrompt,
      '',
      '=== USER TASK ===',
      userPrompt,
    ].join('\n');
  }

  private extractStructuredResponse(raw: string, executor: ExecutorName): string {
    const text = raw.trim();
    if (!text) {
      throw new Error(`${executor} 未返回文本结果。`);
    }

    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const direct = typeof parsed.response === 'string' ? parsed.response.trim() : null;
      if (direct) {
        return direct;
      }

      const nested =
        typeof parsed.result === 'object' && parsed.result !== null
          ? (parsed.result as Record<string, unknown>)
          : null;
      const nestedResult = typeof nested?.response === 'string' ? nested.response.trim() : null;
      if (nestedResult) {
        return nestedResult;
      }

      const content = Array.isArray(parsed.content)
        ? (parsed.content as Array<Record<string, unknown>>)
        : null;
      const contentText = content
        ? content
            .map((entry) => (typeof entry.text === 'string' ? entry.text : ''))
            .join('\n')
            .trim()
        : '';
      if (contentText) {
        return contentText;
      }
    } catch {
      // Fall back to plain text if the CLI is configured to emit plain output.
    }

    return text;
  }

  private formatExecutorError(error: unknown, executor: ExecutorName, fallback: string): Error {
    if (!(error instanceof Error)) {
      return new Error(fallback);
    }

    const details: string[] = [];
    const childLike = error as Error & { stdout?: string; stderr?: string };
    const stderr = typeof childLike.stderr === 'string' ? childLike.stderr.trim() : '';
    const stdout = typeof childLike.stdout === 'string' ? childLike.stdout.trim() : '';

    if (stderr) {
      details.push(`stderr: ${stderr}`);
    }
    if (stdout && stdout !== stderr) {
      details.push(`stdout: ${stdout}`);
    }

    if (details.length === 0) {
      return new Error(error.message || fallback);
    }

    return new Error(`${error.message || fallback} (${details.join(' | ')})`);
  }

  private async runCodex(systemPrompt: string, userPrompt: string): Promise<string> {
    const prompt = this.getAgentPrompt(systemPrompt, userPrompt);
    await this.ensureExecutable(CODEX_CLI_PATH, 'Codex');

    const outputFile = path.join(
      tmpdir(),
      `agency-hq-codex-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    );
    const schemaFile = path.join(
      tmpdir(),
      `agency-hq-codex-schema-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );

    try {
      await fs.writeFile(schemaFile, STRUCTURED_RESPONSE_SCHEMA, 'utf8');
      try {
        await execFileAsync(
          CODEX_CLI_PATH,
          [
            'exec',
            '--skip-git-repo-check',
            '--sandbox',
            'read-only',
            '--ephemeral',
            '-C',
            this.workspaceRoot,
            '--output-schema',
            schemaFile,
            '-o',
            outputFile,
            prompt,
          ],
          {
            env: this.buildExecutorEnv(),
            timeout: this.getDiscussionTimeoutMs(),
            maxBuffer: 1024 * 1024 * 8,
          }
        );
      } catch (error) {
        throw this.formatExecutorError(error, 'codex', 'Codex 执行失败。');
      }

      const text = (await fs.readFile(outputFile, 'utf8')).trim();
      return this.extractStructuredResponse(text, 'codex');
    } finally {
      await fs.rm(outputFile, { force: true }).catch(() => undefined);
      await fs.rm(schemaFile, { force: true }).catch(() => undefined);
    }
  }

  private async runClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    await this.ensureExecutable(CLAUDE_CLI_PATH, 'Claude Code');
    let stdout = '';
    try {
      const result = await execFileAsync(
        CLAUDE_CLI_PATH,
        [
          '-p',
          '--output-format',
          'json',
          '--json-schema',
          STRUCTURED_RESPONSE_SCHEMA,
          '--no-session-persistence',
          '--permission-mode',
          'bypassPermissions',
          '--tools=',
          '--system-prompt',
          systemPrompt,
          userPrompt,
        ],
        {
          cwd: this.workspaceRoot,
          env: this.buildExecutorEnv(),
          timeout: this.getDiscussionTimeoutMs(),
          maxBuffer: 1024 * 1024 * 8,
        }
      );
      stdout = result.stdout;
    } catch (error) {
      throw this.formatExecutorError(error, 'claude', 'Claude Code 执行失败。');
    }

    return this.extractStructuredResponse(stdout, 'claude');
  }

  private async runOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    if (!apiKey) {
      throw new Error('缺少 OPENAI_API_KEY。');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM 请求失败 (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('LLM 未返回可用文本内容。');
    }

    return text;
  }

  private buildKnowledgeContext(task: string): string {
    const history = this.store.searchKnowledge(task);
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

  private buildExpertAssignment(topic: string, agent: Agent, allAgents: Agent[]): string {
    const peers = allAgents
      .map((entry) => `- ${entry.frontmatter.name}: ${entry.frontmatter.description}`)
      .join('\n');

    return [
      `主题：${topic}`,
      '',
      `你当前扮演的专家：${agent.frontmatter.name}`,
      `你的职责：${agent.frontmatter.description}`,
      '',
      '当前讨论阵容：',
      peers,
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

  private toCandidate(agent: Agent, score: number, isActive: boolean): ExpertCandidate {
    return {
      id: agent.id,
      name: agent.frontmatter.name,
      description: agent.frontmatter.description,
      department: agent.department,
      score,
      isActive,
    };
  }

  private rankExperts(topic: string, maxExperts: number): RankedExpert[] {
    const activeIds = new Set(this.store.getActiveIds());
    const ranked = this.scanner
      .getAllAgents()
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

  private calculateSmartScore(agent: Agent, task: string): number {
    const taskFeatures = this.getFeatures(task);
    const nameFeatures = this.getFeatures(agent.frontmatter.name);
    const descFeatures = this.getFeatures(agent.frontmatter.description);
    const idFeatures = this.getFeatures(agent.id);

    let score = 0;
    taskFeatures.forEach((count, feature) => {
      if (nameFeatures.has(feature)) score += count * nameFeatures.get(feature)! * 10;
      if (idFeatures.has(feature)) score += count * idFeatures.get(feature)! * 8;
      if (descFeatures.has(feature)) score += count * descFeatures.get(feature)! * 2;
    });

    return score;
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
}
