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

  app.post('/api/templates/:name/create-task', async (req, res) => {
    const templateName = req.params.name;
    const templates = dependencies.store.getTemplates();
    const template = templates.find(t => t.name === templateName || (t as any).id === templateName);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 1. Create a RequirementDraft based on Template
    const now = new Date().toISOString();
    const intentId = `intent_tpl_${randomUUID()}`;
    const draft: any = {
      id: intentId,
      rawInput: `Instantiated from template: ${template.name}`,
      status: 'plan_ready', // Skip directly to plan ready
      clarificationMessages: [
        { id: randomUUID(), role: 'assistant', content: `Using template: ${template.name}`, timestamp: now }
      ],
      designSummary: template.designSummary,
      implementationPlan: template.implementationPlan,
      suggestedAutonomyLevel: template.implementationPlan?.recommendedAutonomyLevel || 'L2',
      suggestedScenario: template.implementationPlan?.scenario || 'feature-delivery',
      createdAt: now,
      updatedAt: now,
    };

    await dependencies.store.saveRequirementDraft(draft);

    // 2. We can return the intentId and let frontend handle the final confirmation,
    // OR we can trigger the conversion here if lifecycleService is available.
    // Given the V0.4 goal, we return success and the intentId for UX continuity.
    return res.json({ 
      success: true, 
      message: '任务已基于模板初始化，请确认计划后即可开始执行。',
      intentId,
      draft
    });
  });

  app.delete('/api/templates/:name', (req, res) => {
    dependencies.store.deleteTemplate(req.params.name);
    return res.json({ success: true });
  });
}
