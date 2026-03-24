import type express from 'express';
import type { Store } from '../store';

export interface TemplateRouteDependencies {
  store: Store;
}

export function registerTemplateRoutes(app: express.Application, dependencies: TemplateRouteDependencies) {
  app.get('/api/templates', (_req, res) => {
    return res.json(dependencies.store.getTemplates());
  });

  app.post('/api/templates', (req, res) => {
    const { name, activeAgentIds } = req.body;
    if (!name || !Array.isArray(activeAgentIds)) {
      return res.status(400).json({ error: 'Name and activeAgentIds required' });
    }

    dependencies.store.saveTemplate(name, activeAgentIds);
    return res.json({ success: true });
  });

  app.delete('/api/templates/:name', (req, res) => {
    dependencies.store.deleteTemplate(req.params.name);
    return res.json({ success: true });
  });
}
