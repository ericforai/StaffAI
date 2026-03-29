import { z } from 'zod';
import { BaseTool } from './base-tool';
import fs from 'node:fs/promises';
import path from 'node:path';

export class FileWriteTool extends BaseTool<{ path: string; content: string }> {
  name = 'file_write';
  description = 'Write or overwrite workspace files.';
  category = 'filesystem' as const;
  riskLevel = 'medium' as const;
  allowedRoles = ['software-architect', 'backend-developer', 'technical-writer', 'system'];
  schema = z.object({
    path: z.string().describe('Relative path to the file to write.'),
    content: z.string().describe('The content to write to the file.'),
  });

  async run(input: { path: string; content: string }) {
    await fs.mkdir(path.dirname(input.path), { recursive: true });
    await fs.writeFile(input.path, input.content, 'utf-8');
    return {
      summary: `Wrote ${input.content.length} characters to ${input.path}.`,
      payload: { path: input.path, size: input.content.length },
    };
  }
}
