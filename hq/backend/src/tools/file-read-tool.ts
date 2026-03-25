import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BaseTool, ToolContext, ToolResult } from './base-tool';
import type { ToolCategory, ToolRiskLevel } from '../shared/task-types';

export class FileReadTool extends BaseTool<{ path: string }> {
  public readonly name = 'file_read';
  public readonly description = 'Read workspace files with safety checks.';
  public readonly category: ToolCategory = 'filesystem';
  public readonly riskLevel: ToolRiskLevel = 'low';
  public readonly allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher'];

  public readonly schema = z.object({
    path: z.string().describe('Relative path to the file within the workspace.'),
  });

  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    super();
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public async execute(input: { path: string }, _context: ToolContext): Promise<ToolResult> {
    try {
      const targetPath = path.resolve(this.workspaceRoot, input.path);

      if (!targetPath.startsWith(this.workspaceRoot)) {
        return {
          summary: `Failed to read ${input.path}`,
          error: 'Access denied: Path is outside the workspace root.',
        };
      }

      const content = await fs.readFile(targetPath, 'utf8');
      const stats = await fs.stat(targetPath);

      return {
        summary: `Successfully read file: ${input.path} (${stats.size} bytes)`,
        payload: {
          content,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        },
      };
    } catch (error: any) {
      return {
        summary: `Error reading file: ${input.path}`,
        error: error.message,
      };
    }
  }
}
