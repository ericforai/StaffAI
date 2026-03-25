import type express from 'express';
import type { Store } from '../store';
import { ToolGateway } from '../tools/tool-gateway';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

export function registerToolRoutes(
  app: express.Application,
  store: Pick<Store, 'saveToolCallLog'>
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

    const result = await gateway.executeTool(
      toolName,
      typeof req.body?.input === 'object' && req.body?.input !== null ? req.body.input : undefined,
      {
        actorRole,
        taskId: readString(req.body?.taskId),
        executionId: readString(req.body?.executionId),
        approvalGranted: readBoolean(req.body?.approvalGranted),
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
