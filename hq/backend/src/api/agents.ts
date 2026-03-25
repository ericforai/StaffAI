import type express from 'express';
import type { Scanner } from '../scanner';
import type { UserContextService } from '../identity/user-context.js';

export interface AgentRouteDependencies {
  scanner: Scanner;
  userContextService?: UserContextService;
}

export function registerAgentRoutes(app: express.Application, dependencies: AgentRouteDependencies) {
  app.get('/api/agents', (req, res) => {
    const allAgents = dependencies.scanner.getAllAgents();

    // Filter agents by user context if service is available
    const userId = (req as any).userId as string | undefined;
    const filteredAgents = dependencies.userContextService
      ? dependencies.userContextService.filterAgentsByUser(allAgents, userId)
      : allAgents;

    const agents = filteredAgents.map((agent) => ({
      id: agent.id,
      name: agent.frontmatter.name,
      department: agent.department,
      frontmatter: agent.frontmatter,
      profile: agent.profile,
    }));

    return res.json(agents);
  });

  app.get('/api/agents/:id', (req, res) => {
    const agentId = req.params.id;
    const agent = dependencies.scanner.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check user access if user context service is available
    if (dependencies.userContextService) {
      const userId = (req as any).userId as string | undefined;
      const filteredAgents = dependencies.userContextService.filterAgentsByUser([agent], userId);

      if (filteredAgents.length === 0) {
        return res.status(403).json({ error: 'Access denied to this agent' });
      }
    }

    return res.json({
      id: agent.id,
      name: agent.frontmatter.name,
      department: agent.department,
      frontmatter: agent.frontmatter,
      profile: agent.profile,
      content: agent.content,
      systemPrompt: agent.systemPrompt,
    });
  });
}
