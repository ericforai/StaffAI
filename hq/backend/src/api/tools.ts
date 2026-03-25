import type express from 'express';
import type { Store } from '../store';
import { ToolGateway } from '../tools/tool-gateway';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

/** High-risk tools: do not trust approvalGranted without a matching approved record. */
export async function resolveToolApprovalClaim(
  store: Pick<Store, 'getApprovalsByTaskId'>,
  gateway: ToolGateway,
  toolName: string,
  taskId: string | undefined,
  approvalClaimed: boolean,
): Promise<boolean> {
  const tool = gateway.getTool(toolName);
  if (!tool || tool.riskLevel !== 'high') {
    return approvalClaimed;
  }
  if (!approvalClaimed) {
    return false;
  }
  if (!taskId?.trim()) {
    return false;
  }
  const approvals = await store.getApprovalsByTaskId(taskId);
  return approvals.some((a) => a.status === 'approved');
}

export function registerToolRoutes(
  app: express.Application,
  store: Pick<Store, 'saveToolCallLog' | 'getApprovalsByTaskId'>,
) {
  const gateway = new ToolGateway(store);

  app.get('/api/tools', (req, res) => {
    const actorRole = readString(req.query.role) ?? 'dispatcher';
    const tools = gateway.listTools(actorRole);
    return res.json({
      tools,
      actorRole,
      stage: 'sprint-2-tool-gateway',
    });
  });

  app.post('/api/tools/execute', async (req, res) => {
    const toolName = readString(req.body?.toolName);
    const actorRole = readString(req.body?.actorRole) ?? 'dispatcher';

    if (!toolName) {
      return res.status(400).json({
        error: 'toolName is required',
        stage: 'sprint-2-tool-gateway',
      });
    }

    const taskId = readString(req.body?.taskId);
    const approvalGranted = await resolveToolApprovalClaim(
      store,
      gateway,
      toolName,
      taskId,
      readBoolean(req.body?.approvalGranted),
    );

    const result = await gateway.executeTool(
      toolName,
      typeof req.body?.input === 'object' && req.body?.input !== null ? req.body.input : undefined,
      {
        actorRole,
        taskId,
        executionId: readString(req.body?.executionId),
        approvalGranted,
      }
    );

    if (!result.ok) {
      return res.status(result.log.status === 'blocked' ? 403 : 404).json({
        error: result.error,
        tool: result.tool,
        log: result.log,
        stage: 'sprint-2-tool-gateway',
      });
    }

    return res.status(201).json({
      tool: result.tool,
      log: result.log,
      output: result.output,
      stage: 'sprint-2-tool-gateway',
    });
  });
}
