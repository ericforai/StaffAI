import type express from 'express';
import type { DashboardEvent } from '../observability/dashboard-events';
import type { Store } from '../store';

export interface SquadRouteDependencies {
  store: Store;
  broadcast: (event: DashboardEvent) => void;
}

export function registerSquadRoutes(app: express.Application, dependencies: SquadRouteDependencies) {
  app.get('/api/squad', (_req, res) => {
    return res.json({ activeAgentIds: dependencies.store.getActiveIds() });
  });

  app.post('/api/squad', (req, res) => {
    const { activeAgentIds } = req.body;
    if (!Array.isArray(activeAgentIds)) {
      return res.status(400).json({ error: 'activeAgentIds must be an array' });
    }

    dependencies.store.save(activeAgentIds);
    dependencies.broadcast({ type: 'SQUAD_UPDATED', activeAgentIds });

    return res.json({ success: true, activeAgentIds });
  });
}
