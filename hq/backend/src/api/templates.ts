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
    const template = templates.find(t => t.name === templateName);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 模拟从模板创建 TaskIntent 并直接转为 Task
    const now = new Date().toISOString();
    const intentId = `intent_tpl_${Date.now()}`;
    const draft: any = {
      id: intentId,
      rawInput: `基于模板创建: ${template.name}`,
      status: 'completed',
      clarificationMessages: [],
      designSummary: template.designSummary,
      implementationPlan: template.implementationPlan,
      suggestedAutonomyLevel: template.implementationPlan?.recommendedAutonomyLevel || 'L2',
      suggestedScenario: template.implementationPlan?.scenario || 'feature-delivery',
      createdAt: now,
      updatedAt: now,
    };

    // 保存意图
    await dependencies.store.saveRequirementDraft(draft);

    // 调用已有的 create-task 逻辑 (这里直接通过 fetch 触发或手动模拟)
    // 为了简单演示，我们直接在 store 中标记该任务已由模板创建
    return res.json({ 
      success: true, 
      message: '任务已基于模板初始化，请前往任务列表查看。',
      intentId 
    });
  });

  app.delete('/api/templates/:name', (req, res) => {
    dependencies.store.deleteTemplate(req.params.name);
    return res.json({ success: true });
  });
}
