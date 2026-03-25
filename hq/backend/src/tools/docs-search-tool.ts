import { z } from 'zod';
import { BaseTool, ToolContext, ToolResult } from './base-tool';

const DocsSearchSchema = z.object({
  query: z.string(),
});

type DocsSearchInput = z.infer<typeof DocsSearchSchema>;

export class DocsSearchTool extends BaseTool<DocsSearchInput> {
  public readonly name = 'docs_search';
  public readonly description = 'Search internal documentation and knowledge base.';
  public readonly category = 'knowledge';
  public readonly riskLevel = 'low' as const;
  public readonly allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher'];
  public readonly schema = DocsSearchSchema;

  public async execute(input: DocsSearchInput, context: ToolContext): Promise<ToolResult> {
    return {
      summary: `Searched documentation for: ${input.query}`,
      payload: { results: [] },
    };
  }
}
