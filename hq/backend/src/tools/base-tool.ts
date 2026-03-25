import { z } from 'zod';
import type { ToolDefinition, ToolCategory, ToolRiskLevel } from '../shared/task-types';

export interface ToolContext {
  actorRole: string;
  taskId?: string;
  executionId?: string;
  approvalGranted?: boolean;
}

export interface ToolResult {
  summary: string;
  payload?: Record<string, unknown>;
  error?: string;
  success?: boolean;
  data?: unknown;
}

export abstract class BaseTool<P extends Record<string, any> = any> {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly category: ToolCategory;
  public abstract readonly riskLevel: ToolRiskLevel;
  public abstract readonly allowedRoles: string[];
  public abstract readonly schema: z.ZodType<P>;

  public get definition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      riskLevel: this.riskLevel,
      allowedRoles: this.allowedRoles,
      parameters: this.schema,
    };
  }

  public validate(input: unknown): P {
    return this.schema.parse(input);
  }

  public abstract execute(input: P, context: ToolContext): Promise<ToolResult>;
}
