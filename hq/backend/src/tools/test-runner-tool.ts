import { z } from 'zod';
import { BaseTool } from './base-tool';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class TestRunnerTool extends BaseTool<{ target: string }> {
  name = 'test_runner';
  description = 'Run bounded project verification commands.';
  category = 'quality' as const;
  riskLevel = 'medium' as const;
  allowedRoles = ['reviewer', 'software-architect', 'backend-developer', 'system'];
  schema = z.object({
    target: z.string().describe('Test target or suite name (e.g. "backend", "frontend").'),
  });

  async run(input: { target: string }) {
    if (process.env.AGENCY_UNDER_NODE_TEST === '1') {
      return {
        summary: `Mock test execution successful for ${input.target} (AGENCY_UNDER_NODE_TEST=1)`,
        payload: { target: input.target, passed: true, simulated: true },
      };
    }

    try {
      const command = input.target === 'backend' ? 'cd hq/backend && npm test' : 'npm test';
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
      return {
        summary: `Ran tests for ${input.target} successfully.`,
        payload: { stdout, stderr, exitCode: 0 },
      };
    } catch (error: any) {
      return {
        summary: `Tests for ${input.target} failed.`,
        payload: { stdout: error.stdout, stderr: error.stderr, exitCode: error.code || 1 },
      };
    }
  }
}
