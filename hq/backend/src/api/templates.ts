import type express from 'express';
import type { Store } from '../store';

export interface TemplateRouteDependencies {
  store: Store;
}

export function registerTemplateRoutes(app: express.Application, dependencies: TemplateRouteDependencies) {
  app.get('/api/templates', (_req, res) => {
    return res.json(dependencies.store.getTemplates());
  });

  app.post('/api/tasks/:id/save-template', async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Template name required' });
    }

    const template = await dependencies.store.saveTemplateFromTask(req.params.id, name, description);
    if (!template) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json({ success: true, template });
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
