import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { ToolCallLog, ToolDefinition } from '../shared/task-types';
import { BaseTool, ToolContext, ToolResult } from './base-tool';
import { FileReadTool } from './file-read-tool';
import { FileWriteTool } from './file-write-tool';
import { GitReadTool, GitDiffTool } from './git-tools';
import { TestRunnerTool } from './test-runner-tool';
import { DocsSearchTool } from './docs-search-tool';
import { RuntimeExecutorTool } from './runtime-executor-tool';

export { ToolContext, ToolResult };

export interface ToolExecutionResult {
  ok: boolean;
  tool: ToolDefinition;
  log: ToolCallLog;
  output?: ToolResult;
  error?: string;
}

export class ToolGateway {
  private readonly tools = new Map<string, BaseTool>();

  constructor(private readonly store: Pick<Store, 'saveToolCallLog'>) {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.registerTool(new FileReadTool());
    this.registerTool(new FileWriteTool());
    this.registerTool(new GitReadTool());
    this.registerTool(new GitDiffTool());
    this.registerTool(new TestRunnerTool());
    this.registerTool(new DocsSearchTool());
    this.registerTool(new RuntimeExecutorTool());
  }

  public registerTool(tool: BaseTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  public listTools(actorRole: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((tool) => tool.definition.allowedRoles.includes(actorRole))
      .map((tool) => tool.definition);
  }

  public getTool(toolName: string): BaseTool | null {
    return this.tools.get(toolName) ?? null;
  }

  public checkPermission(
    actorRole: string,
    toolName: string,
    context: Pick<ToolContext, 'approvalGranted'> = {}
  ): { allowed: boolean; tool: BaseTool | null; reason?: string } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { allowed: false, tool: null, reason: 'tool not found' };
    }

    if (!tool.definition.allowedRoles.includes(actorRole)) {
      return { allowed: false, tool, reason: `role '${actorRole}' is not allowed to use tool '${toolName}'` };
    }

    if (tool.definition.riskLevel === 'high' && !context.approvalGranted) {
      return { allowed: false, tool, reason: 'high-risk tool requires approval' };
    }

    return { allowed: true, tool };
  }

  public async executeTool(
    toolName: string,
    input: Record<string, unknown> | undefined,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const permission = this.checkPermission(context.actorRole, toolName, {
      approvalGranted: context.approvalGranted,
    });
    const createdAt = new Date().toISOString();

    if (!permission.tool) {
      const log = this.createBaseLog(toolName, context, 'failed', 'low', input, createdAt);
      log.errorMessage = permission.reason;
      await this.store.saveToolCallLog(log);
      return {
        ok: false,
        tool: { name: toolName, category: 'runtime', riskLevel: 'low', allowedRoles: [] },
        log,
        error: permission.reason,
      };
    }

    const tool = permission.tool;

    if (!permission.allowed) {
      const log = this.createBaseLog(tool.definition.name, context, 'blocked', tool.definition.riskLevel, input, createdAt);
      log.errorMessage = permission.reason;
      await this.store.saveToolCallLog(log);
      return { ok: false, tool: tool.definition, log, error: permission.reason };
    }

    try {
      // 1. Validate Input
      const validatedInput = tool.validate(input);

      // 2. Execute
      const output = await tool.execute(validatedInput, context);

      const status = output.error ? 'failed' : 'completed';
      const log = this.createBaseLog(tool.name, context, status, tool.riskLevel, input, createdAt);

      log.outputSummary = output.summary;
      log.errorMessage = output.error;
      log.fullInput = validatedInput;
      log.fullOutput = output.payload;
      log.updatedAt = new Date().toISOString();

      await this.store.saveToolCallLog(log);

      return {
        ok: status === 'completed',
        tool: tool.definition,
        log,
        output,
        error: output.error,
      };
    } catch (error: any) {
      const log = this.createBaseLog(tool.definition.name, context, 'failed', tool.definition.riskLevel, input, createdAt);
      log.errorMessage = `Validation or Execution error: ${error.message}`;
      await this.store.saveToolCallLog(log);
      
      return {
        ok: false,
        tool: tool.definition,
        log,
        error: error.message,
      };
    }
  }

  private createBaseLog(
    toolName: string,
    context: ToolContext,
    status: ToolCallLog['status'],
    riskLevel: ToolCallLog['riskLevel'],
    input: unknown,
    createdAt: string
  ): ToolCallLog {
    return {
      id: randomUUID(),
      executionId: context.executionId,
      taskId: context.taskId,
      toolName,
      actorRole: context.actorRole,
      status,
      riskLevel,
      inputSummary: this.summarizeInput(input),
      createdAt,
      updatedAt: createdAt,
    };
  }

  private summarizeInput(input: unknown): string {
    if (input === undefined) return '';
    try {
      const serialized = JSON.stringify(input);
      return serialized.length > 240 ? `${serialized.slice(0, 237)}...` : serialized;
    } catch {
      return String(input);
    }
  }
}

