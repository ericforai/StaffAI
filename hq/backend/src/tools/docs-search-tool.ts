import { z } from 'zod';
import { BaseTool } from './base-tool';

export class DocsSearchTool extends BaseTool<{ query: string }> {
  name = 'docs_search';
  description = 'Search project and platform documentation context.';
  category = 'knowledge' as const;
  riskLevel = 'low' as const;
  allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher', 'system'];
  schema = z.object({
    query: z.string().describe('Search query for documentation.'),
  });

  async run(input: { query: string }) {
    return {
      summary: `Searched documentation for: ${input.query}.`,
      payload: { query: input.query, matches: [] },
    };
  }
}
