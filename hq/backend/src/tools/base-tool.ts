import { z } from 'zod';
import type { ToolDefinition } from '../shared/task-types';

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
      inputSchema: this.schema as any,
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
