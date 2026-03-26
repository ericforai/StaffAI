import { z } from 'zod';
import type { ToolDefinition } from '../shared/task-types';
import { toJsonSchema } from './json-schema';

export interface ToolContext {
  executionId?: string;
  taskId?: string;
  actorRole: string;
  approvalGranted?: boolean;
}

export type ToolActorContext = ToolContext;

export interface ToolResult {
  summary: string;
  payload?: Record<string, unknown>;
  error?: string;
}

const TOOL_RESULT_SCHEMA = z.object({
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export abstract class BaseTool<T extends Record<string, any> = any> {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly category: 'knowledge' | 'runtime' | 'filesystem' | 'repository' | 'quality';
  public abstract readonly riskLevel: 'low' | 'medium' | 'high';
  public abstract readonly allowedRoles: string[];
  public abstract readonly schema: z.ZodType<T>;

  get definition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      riskLevel: this.riskLevel,
      allowedRoles: this.allowedRoles,
      inputSchema: toJsonSchema(this.schema, `${this.name}_input`),
      outputSchema: toJsonSchema(TOOL_RESULT_SCHEMA, `${this.name}_output`),
    };
  }

  public validate(input: unknown): T {
    return this.schema.parse(input);
  }

  public abstract run(input: T): Promise<{
    summary: string;
    payload?: Record<string, unknown>;
  }>;
}
