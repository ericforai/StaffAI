import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BaseTool, ToolContext, ToolResult } from './base-tool';
import type { ToolCategory, ToolRiskLevel } from '../shared/task-types';

export class FileWriteTool extends BaseTool<{ path: string; content: string }> {
  public readonly name = 'file_write';
  public readonly description = 'Write or update a file in the workspace (HIGH RISK).';
  public readonly category: ToolCategory = 'filesystem';
  public readonly riskLevel: ToolRiskLevel = 'high';
  public readonly allowedRoles = ['software-architect', 'backend-developer'];

  public readonly schema = z.object({
    path: z.string().describe('Relative path to the file within the workspace.'),
    content: z.string().describe('Content to write to the file.'),
  });

  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    super();
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public async execute(input: { path: string; content: string }, context: ToolContext): Promise<ToolResult> {
    if (!context.approvalGranted) {
      return {
        summary: `Blocked writing to ${input.path}`,
        error: 'High-risk tool requires explicit approval.',
      };
    }

    try {
      const targetPath = path.resolve(this.workspaceRoot, input.path);

      if (!targetPath.startsWith(this.workspaceRoot)) {
        return {
          summary: `Failed to write ${input.path}`,
          error: 'Access denied: Path is outside the workspace root.',
        };
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, input.content, 'utf8');

      return {
        summary: `Successfully wrote file: ${input.path}`,
        payload: {
          path: input.path,
          bytes: input.content.length,
        },
      };
    } catch (error: any) {
      return {
        summary: `Error writing file: ${input.path}`,
        error: error.message,
      };
    }
  }
}
