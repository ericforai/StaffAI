import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { ToolCallLog, ToolDefinition } from '../shared/task-types';

export interface ToolActorContext {
  actorRole: string;
  taskId?: string;
  executionId?: string;
  approvalGranted?: boolean;
}

export interface ToolExecutionResult {
  ok: boolean;
  tool: ToolDefinition;
  log: ToolCallLog;
  output?: {
    summary: string;
    payload?: Record<string, unknown>;
  };
  error?: string;
}

export function getDefaultToolCatalog(): ToolDefinition[] {
  return [
    {
      name: 'docs_search',
      category: 'knowledge',
      riskLevel: 'low',
      allowedRoles: ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher'],
      description: 'Search project and platform documentation context.',
    },
    {
      name: 'runtime_executor',
      category: 'runtime',
      riskLevel: 'high',
      allowedRoles: ['software-architect', 'backend-developer'],
      description: 'Run executor-backed implementation work.',
    },
    {
      name: 'file_read',
      category: 'filesystem',
      riskLevel: 'low',
      allowedRoles: ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher'],
      description: 'Read workspace files.',
    },
    {
      name: 'git_diff',
      category: 'repository',
      riskLevel: 'low',
      allowedRoles: ['reviewer', 'software-architect', 'backend-developer', 'technical-writer'],
      description: 'Inspect repository diff summary.',
    },
    {
      name: 'test_runner',
      category: 'quality',
      riskLevel: 'medium',
      allowedRoles: ['reviewer', 'software-architect', 'backend-developer'],
      description: 'Run bounded project verification commands.',
    },
  ];
}

function summarizeInput(input: unknown): string {
  if (input === undefined) {
    return '';
  }

  try {
    const serialized = JSON.stringify(input);
    return serialized.length > 240 ? `${serialized.slice(0, 237)}...` : serialized;
  } catch {
    return String(input);
  }
}

function summarizeOutput(output: Record<string, unknown>): string {
  const summary = typeof output.summary === 'string' ? output.summary : JSON.stringify(output);
  return summary.length > 240 ? `${summary.slice(0, 237)}...` : summary;
}

export class ToolGateway {
  private readonly catalog: ToolDefinition[];

  constructor(
    private readonly store: Pick<Store, 'saveToolCallLog'>,
    catalog: ToolDefinition[] = getDefaultToolCatalog()
  ) {
    this.catalog = [...catalog];
  }

  public listTools(actorRole: string): ToolDefinition[] {
    return this.catalog.filter((tool) => tool.allowedRoles.includes(actorRole));
  }

  public getTool(toolName: string): ToolDefinition | null {
    return this.catalog.find((tool) => tool.name === toolName) ?? null;
  }

  public checkPermission(
    actorRole: string,
    toolName: string,
    context: Pick<ToolActorContext, 'approvalGranted'> = {}
  ): { allowed: boolean; tool: ToolDefinition | null; reason?: string } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { allowed: false, tool: null, reason: 'tool not found' };
    }

    if (!tool.allowedRoles.includes(actorRole)) {
      return { allowed: false, tool, reason: 'role is not allowed to use this tool' };
    }

    if (tool.riskLevel === 'high' && !context.approvalGranted) {
      return { allowed: false, tool, reason: 'high-risk tool requires approval' };
    }

    return { allowed: true, tool };
  }

  public async executeTool(
    toolName: string,
    input: Record<string, unknown> | undefined,
    context: ToolActorContext
  ): Promise<ToolExecutionResult> {
    const permission = this.checkPermission(context.actorRole, toolName, {
      approvalGranted: context.approvalGranted,
    });
    const createdAt = new Date().toISOString();

    if (!permission.tool) {
      const log: ToolCallLog = {
        id: randomUUID(),
        executionId: context.executionId,
        taskId: context.taskId,
        toolName,
        actorRole: context.actorRole,
        status: 'failed',
        riskLevel: 'low',
        inputSummary: summarizeInput(input),
        errorMessage: permission.reason,
        createdAt,
        updatedAt: createdAt,
      };
      await this.store.saveToolCallLog(log);
      return { ok: false, tool: { name: toolName, category: 'runtime', riskLevel: 'low', allowedRoles: [] }, log, error: permission.reason };
    }

    if (!permission.allowed) {
      const log: ToolCallLog = {
        id: randomUUID(),
        executionId: context.executionId,
        taskId: context.taskId,
        toolName: permission.tool.name,
        actorRole: context.actorRole,
        status: 'blocked',
        riskLevel: permission.tool.riskLevel,
        inputSummary: summarizeInput(input),
        errorMessage: permission.reason,
        createdAt,
        updatedAt: createdAt,
      };
      await this.store.saveToolCallLog(log);
      return { ok: false, tool: permission.tool, log, error: permission.reason };
    }

    const output = this.simulateToolExecution(permission.tool, input);
    const log: ToolCallLog = {
      id: randomUUID(),
      executionId: context.executionId,
      taskId: context.taskId,
      toolName: permission.tool.name,
      actorRole: context.actorRole,
      status: 'completed',
      riskLevel: permission.tool.riskLevel,
      inputSummary: summarizeInput(input),
      outputSummary: summarizeOutput(output),
      createdAt,
      updatedAt: createdAt,
    };
    await this.store.saveToolCallLog(log);

    return {
      ok: true,
      tool: permission.tool,
      log,
      output,
    };
  }

  private simulateToolExecution(tool: ToolDefinition, input: Record<string, unknown> | undefined) {
    switch (tool.name) {
      case 'docs_search':
        return {
          summary: `Searched docs for ${typeof input?.query === 'string' ? input.query : 'requested topic'}.`,
          payload: { matches: 3 },
        };
      case 'runtime_executor':
        return {
          summary: `Prepared runtime execution for ${typeof input?.task === 'string' ? input.task : 'requested task'}.`,
          payload: { executor: input?.executor ?? 'codex', simulated: true },
        };
      case 'file_read':
        return {
          summary: `Read file context for ${typeof input?.path === 'string' ? input.path : 'requested path'}.`,
          payload: { bytes: 128, simulated: true },
        };
      case 'git_diff':
        return {
          summary: `Collected git diff summary for ${typeof input?.ref === 'string' ? input.ref : 'working tree'}.`,
          payload: { filesChanged: 2, simulated: true },
        };
      case 'test_runner':
        return {
          summary: `Ran bounded test target ${typeof input?.target === 'string' ? input.target : 'default suite'}.`,
          payload: { passed: true, simulated: true },
        };
      default:
        return {
          summary: `Executed ${tool.name}.`,
          payload: { simulated: true },
        };
    }
  }
}
