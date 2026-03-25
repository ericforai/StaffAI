import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { ToolCallLog, ToolDefinition } from '../shared/task-types';
import { BaseTool } from './base-tool';
import { FileReadTool } from './file-read-tool';
import { FileWriteTool } from './file-write-tool';
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
    this.registerTool(new TestRunnerTool());
    this.registerTool(new DocsSearchTool());
    this.registerTool(new RuntimeExecutorTool());
  }

  public registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  public listTools(actorRole: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((tool) => tool.allowedRoles.includes(actorRole))
      .map((tool) => tool.definition);
  }

  public getTool(toolName: string): BaseTool | null {
    return this.tools.get(toolName) ?? null;
  }

  public checkPermission(
    actorRole: string,
    toolName: string,
    context: Pick<ToolActorContext, 'approvalGranted'> = {}
  ): { allowed: boolean; tool: BaseTool | null; reason?: string } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { allowed: false, tool: null, reason: 'tool not found' };
    }

    if (!tool.allowedRoles.includes(actorRole)) {
      return { allowed: false, tool, reason: 'role is not allowed' };
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
      const log = this.createBaseLog(toolName, context, createdAt, 'failed', 'low', input);
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
      const log = this.createBaseLog(permission.tool.name, context, createdAt, 'blocked', permission.tool.riskLevel, input);
      log.errorMessage = permission.reason;
      await this.store.saveToolCallLog(log);
      return { ok: false, tool: permission.tool.definition, log, error: permission.reason };
    }

    try {
      const validatedInput = permission.tool.validate(input || {});
      const output = await permission.tool.run(validatedInput);

      const log = this.createBaseLog(permission.tool.name, context, createdAt, 'completed', permission.tool.riskLevel, input);
      log.outputSummary = output.summary;
      await this.store.saveToolCallLog(log);

      return {
        ok: true,
        tool: permission.tool.definition,
        log,
        output,
      };
    } catch (error: any) {
      const log = this.createBaseLog(permission.tool.name, context, createdAt, 'failed', permission.tool.riskLevel, input);
      log.errorMessage = error.message;
      await this.store.saveToolCallLog(log);
      return { ok: false, tool: permission.tool.definition, log, error: error.message };
    }
  }

  private createBaseLog(
    toolName: string,
    context: ToolActorContext,
    createdAt: string,
    status: ToolCallLog['status'],
    riskLevel: ToolCallLog['riskLevel'],
    input: any
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
    if (!input) return '';
    const serialized = JSON.stringify(input);
    return serialized.length > 200 ? serialized.slice(0, 197) + '...' : serialized;
  }
}

