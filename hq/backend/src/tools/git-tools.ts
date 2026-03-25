import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool, ToolContext, ToolResult } from './base-tool';
import type { ToolCategory, ToolRiskLevel } from '../shared/task-types';

const execAsync = promisify(exec);

export class GitReadTool extends BaseTool<{ command: string; args?: string[] }> {
  public readonly name = 'git_read';
  public readonly description = 'Read git repository information (branch, status, log).';
  public readonly category: ToolCategory = 'repository';
  public readonly riskLevel: ToolRiskLevel = 'low';
  public readonly allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'technical-writer', 'dispatcher'];

  public readonly schema = z.object({
    command: z.enum(['branch', 'status', 'log', 'show']).default('status'),
    args: z.array(z.string()).optional(),
  });

  public async execute(input: { command: string; args?: string[] }, _context: ToolContext): Promise<ToolResult> {
    try {
      const args = input.args?.join(' ') ?? '';
      const fullCommand = `git ${input.command} ${args}`;
      const { stdout, stderr } = await execAsync(fullCommand);

      if (stderr && !stdout) {
        return {
          summary: `Git ${input.command} failed`,
          error: stderr,
        };
      }

      return {
        summary: `Successfully ran Git ${input.command}`,
        payload: {
          stdout,
          stderr,
        },
      };
    } catch (error: any) {
      return {
        summary: `Error running Git ${input.command}`,
        error: error.message,
      };
    }
  }
}

export class GitDiffTool extends BaseTool<{ ref?: string }> {
  public readonly name = 'git_diff';
  public readonly description = 'Get git diff summary.';
  public readonly category: ToolCategory = 'repository';
  public readonly riskLevel: ToolRiskLevel = 'low';
  public readonly allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'technical-writer'];

  public readonly schema = z.object({
    ref: z.string().optional().describe('The git ref to diff against (e.g. HEAD, origin/main).'),
  });

  public async execute(input: { ref?: string }, _context: ToolContext): Promise<ToolResult> {
    try {
      const { stdout } = await execAsync(`git diff ${input.ref ?? ''}`);

      return {
        summary: `Successfully gathered Git diff ${input.ref ?? 'working tree'}`,
        payload: {
          diff: stdout,
        },
      };
    } catch (error: any) {
      return {
        summary: `Error running Git diff`,
        error: error.message,
      };
    }
  }
}
