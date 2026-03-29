import { z } from 'zod';
import { BaseTool } from './base-tool';
import fs from 'node:fs/promises';

export class FileReadTool extends BaseTool<{ path: string }> {
  name = 'file_read';
  description = 'Read workspace files.';
  category = 'filesystem' as const;
  riskLevel = 'low' as const;
  allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher', 'system'];
  schema = z.object({
    path: z.string().describe('Relative path to the file to read.'),
  });

  async run(input: { path: string }) {
    const content = await fs.readFile(input.path, 'utf-8');
    return {
      summary: `Read content of ${input.path} (${content.length} characters).`,
      payload: { path: input.path, content, size: content.length },
    };
  }
}
