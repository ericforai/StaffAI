import type express from 'express';
import { taskRepository } from '../persistence/repositories';
import { ok, fail } from '../types';
import type { TaskStatus, TaskPriority, RelatedType } from '../types';
import {
  authMiddleware,
  requirePermission,
  securityGate,
  buildCtx,
  logAudit,
} from '../middleware/security';

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const VALID_RELATED: RelatedType[] = ['contact', 'company', 'deal'];

export function registerTaskRoutes(app: express.Application): void {

  // GET /api/crm/tasks
  app.get('/api/crm/tasks', authMiddleware, requirePermission('tasks:read'), (_req, res) => {
    res.json(ok(taskRepository.list()));
  });

  // POST /api/crm/tasks
  app.post('/api/crm/tasks', authMiddleware, requirePermission('tasks:write'), (req, res) => {
    const ctx = buildCtx(req, 'CREATE', 'task', 'new');
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const { title, description, relatedType, relatedId, dueDate, status, priority } = req.body ?? {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json(fail('title is required'));
      return;
    }
    const parsedStatus: TaskStatus = VALID_STATUSES.includes(status) ? status : 'todo';
    const parsedPriority: TaskPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
    const parsedRelated: RelatedType | null =
      relatedType && VALID_RELATED.includes(relatedType) ? relatedType : null;

    const task = taskRepository.create({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      relatedType: parsedRelated,
      relatedId: typeof relatedId === 'string' ? relatedId : null,
      dueDate: typeof dueDate === 'string' ? dueDate : '',
      status: parsedStatus,
      priority: parsedPriority,
    });
    logAudit(ctx, 'ALLOWED', undefined, { taskId: task.id });
    res.status(201).json(ok(task));
  });

  // GET /api/crm/tasks/:id
  app.get('/api/crm/tasks/:id', authMiddleware, requirePermission('tasks:read'), (req, res) => {
    const task = taskRepository.getById(req.params.id);
    if (!task) {
      res.status(404).json(fail('task not found'));
      return;
    }
    res.json(ok(task));
  });

  // PUT /api/crm/tasks/:id
  app.put('/api/crm/tasks/:id', authMiddleware, requirePermission('tasks:write'), (req, res) => {
    const ctx = buildCtx(req, 'UPDATE', 'task', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const body = req.body ?? {};
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      res.status(400).json(fail('invalid status value'));
      return;
    }
    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      res.status(400).json(fail('invalid priority value'));
      return;
    }
    if (body.relatedType !== undefined && !VALID_RELATED.includes(body.relatedType) && body.relatedType !== null) {
      res.status(400).json(fail('invalid relatedType value'));
      return;
    }
    const updated = taskRepository.update(req.params.id, body);
    if (!updated) {
      res.status(404).json(fail('task not found'));
      return;
    }
    logAudit(ctx, 'ALLOWED', undefined, { taskId: updated.id });
    res.json(ok(updated));
  });

  // DELETE /api/crm/tasks/:id
  app.delete('/api/crm/tasks/:id', authMiddleware, requirePermission('tasks:delete'), (req, res) => {
    const ctx = buildCtx(req, 'DELETE', 'task', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const deleted = taskRepository.delete(req.params.id);
    if (!deleted) {
      res.status(404).json(fail('task not found'));
      return;
    }
    logAudit(ctx, 'ALLOWED', undefined, { taskId: req.params.id });
    res.json(ok(null));
  });
}
