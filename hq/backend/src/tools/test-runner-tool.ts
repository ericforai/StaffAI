import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool, ToolContext, ToolResult } from './base-tool';
import type { ToolCategory, ToolRiskLevel } from '../shared/task-types';

const execAsync = promisify(exec);

export type TestRunnerExec = (
  command: string,
  options: { timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultTestRunnerExec: TestRunnerExec = async (command, options) => {
  const result = await execAsync(command, options);
  return {
    stdout: String(result.stdout),
    stderr: String(result.stderr),
  };
};

export class TestRunnerTool extends BaseTool<{ target?: string }> {
  public readonly name = 'test_runner';
  public readonly description = 'Run project tests (MEDIUM RISK).';
  public readonly category: ToolCategory = 'quality';
  public readonly riskLevel: ToolRiskLevel = 'medium';
  public readonly allowedRoles = ['reviewer', 'software-architect', 'backend-developer'];

  public readonly schema = z.object({
    target: z.string().optional().describe('Test target or command (e.g. backend, frontend). Defaults to workspace-defined test.'),
  });

  constructor(private readonly runCommand: TestRunnerExec = defaultTestRunnerExec) {
    super();
  }

  public async execute(input: { target?: string }, _context: ToolContext): Promise<ToolResult> {
    try {
      const command = input.target === 'backend' ? 'cd hq/backend && npm test' : 'npm test';
      const { stdout, stderr } = await this.runCommand(command, { timeout: 60000 });

      return {
        summary: `Successfully ran tests for ${input.target ?? 'workspace'}`,
        payload: {
          stdout,
          stderr,
          passed: true,
        },
      };
    } catch (error: any) {
      return {
        summary: `Tests failed for ${input.target ?? 'workspace'}`,
        error: error.message,
        payload: {
          stdout: error.stdout,
          stderr: error.stderr,
          passed: false,
        },
      };
    }
  }
}
