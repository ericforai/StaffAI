import type express from 'express';
import type { Scanner } from '../scanner';

export interface AgentRouteDependencies {
  scanner: Scanner;
}

export function registerAgentRoutes(app: express.Application, dependencies: AgentRouteDependencies) {
  app.get('/api/agents', (_req, res) => {
    const agents = dependencies.scanner.getAllAgents().map((agent) => ({
      id: agent.id,
      name: agent.frontmatter.name,
      department: agent.department,
      frontmatter: agent.frontmatter,
      profile: agent.profile,
    }));

    return res.json(agents);
  });
}
