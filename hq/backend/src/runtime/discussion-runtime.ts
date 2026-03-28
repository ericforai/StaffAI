import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { buildDiscussionStartupCheck } from './discussion-startup-check';
import {
  buildAgentPrompt,
  buildExecutorEnv,
  extractStructuredResponse,
  formatExecutorError,
  resolveExecutorAttempts,
  resolveExecutorPreference,
} from './discussion-executor';
import type { ExecutorName, StartupCheckResult } from './discussion-types';

const execFileAsync = promisify(execFile);
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

/**
 * Allowed MCP tools for expert discussion.
 * Only search-related tools are permitted.
 */
const ALLOWED_TOOL_PATTERNS = [
  'mcp__web-readers__*',
  'mcp__web-reader__*',
  'WebSearch',
];

const EXPERT_SYSTEM_PROMPT = `You are an expert advisor with access to web search tools.
You can search the internet to provide current, accurate information in your area of expertise.`;

interface DiscussionRuntimeOptions {
  workspaceRoot: string;
  claudePath: string;
  codexPath: string;
}

export class DiscussionRuntime {
  private workspaceRoot: string;
  private claudePath: string;
  private codexPath: string;
  private codexSchemaFilePath?: string;

  constructor(options: DiscussionRuntimeOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.claudePath = options.claudePath;
    this.codexPath = options.codexPath;
  }

  public async generateText(systemPrompt: string, userPrompt: string): Promise<{ text: string; executor: ExecutorName }> {
    const preference = resolveExecutorPreference(process.env.AGENCY_DISCUSSION_EXECUTOR);
    const attempts = resolveExecutorAttempts(preference);
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

  public async getStartupCheck(): Promise<StartupCheckResult> {
    const preferredExecutor = resolveExecutorPreference(process.env.AGENCY_DISCUSSION_EXECUTOR);
    const claudeReady = await this.isExecutableAvailable(this.claudePath);
    const codexReady = await this.isExecutableAvailable(this.codexPath);
    const openAiReady = Boolean(process.env.OPENAI_API_KEY);
    const sandboxNetworkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1';
    return buildDiscussionStartupCheck({
      preferredExecutor,
      claudeReady,
      codexReady,
      openAiReady,
      discussionTimeoutMs: this.getDiscussionTimeoutMs(),
      sandboxNetworkDisabled,
      claudePath: this.claudePath,
      codexPath: this.codexPath,
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

  private getExecutorEnv(): NodeJS.ProcessEnv {
    return buildExecutorEnv(process.env);
  }

  private getAgentPrompt(systemPrompt: string, userPrompt: string): string {
    return buildAgentPrompt(systemPrompt, userPrompt);
  }

  private async getCodexSchemaFilePath(): Promise<string> {
    if (this.codexSchemaFilePath) {
      return this.codexSchemaFilePath;
    }

    const schemaFilePath = path.join(tmpdir(), `agency-hq-codex-schema-${process.pid}.json`);
    try {
      await fs.access(schemaFilePath);
    } catch {
      await fs.writeFile(schemaFilePath, STRUCTURED_RESPONSE_SCHEMA, 'utf8');
    }

    this.codexSchemaFilePath = schemaFilePath;
    return schemaFilePath;
  }

  private async runCodex(systemPrompt: string, userPrompt: string): Promise<string> {
    const prompt = this.getAgentPrompt(systemPrompt, userPrompt);
    await this.ensureExecutable(this.codexPath, 'Codex');

    const outputFile = path.join(
      tmpdir(),
      `agency-hq-codex-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    );

    try {
      const schemaFile = await this.getCodexSchemaFilePath();
      try {
        await execFileAsync(
          this.codexPath,
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
            env: this.getExecutorEnv(),
            timeout: this.getDiscussionTimeoutMs(),
            maxBuffer: 1024 * 1024 * 8,
          }
        );
      } catch (error) {
        throw formatExecutorError(error, 'codex', 'Codex 执行失败。');
      }

      const text = (await fs.readFile(outputFile, 'utf8')).trim();
      return extractStructuredResponse(text, 'codex');
    } finally {
      await fs.rm(outputFile, { force: true }).catch(() => undefined);
    }
  }

  private async runClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    await this.ensureExecutable(this.claudePath, 'Claude Code');
    let stdout = '';
    try {
      const args = [
        '-p',
        '--output-format',
        'json',
        '--json-schema',
        STRUCTURED_RESPONSE_SCHEMA,
        '--no-session-persistence',
        '--permission-mode',
        'bypassPermissions',
        '--allowed-tools',
        ALLOWED_TOOL_PATTERNS.join(','),
        '--system-prompt',
        `${EXPERT_SYSTEM_PROMPT}\n\n${systemPrompt}`,
        userPrompt,
      ];

      const result = await execFileAsync(
        this.claudePath,
        args,
        {
          cwd: this.workspaceRoot,
          env: this.getExecutorEnv(),
          timeout: this.getDiscussionTimeoutMs(),
          maxBuffer: 1024 * 1024 * 8,
        }
      );
      stdout = result.stdout;
    } catch (error) {
      throw formatExecutorError(error, 'claude', 'Claude Code 执行失败。');
    }

    return extractStructuredResponse(stdout, 'claude');
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
}
