import type express from 'express';
import { contactRepository } from '../persistence/repositories';
import { ok, fail } from '../types';
import {
  authMiddleware,
  requirePermission,
  securityGate,
  buildCtx,
  logAudit,
} from '../middleware/security';

export function registerContactRoutes(app: express.Application): void {

  // GET /api/crm/contacts — any authenticated user
  app.get('/api/crm/contacts', authMiddleware, requirePermission('contacts:read'), (_req, res) => {
    res.json(ok(contactRepository.list()));
  });

  // POST /api/crm/contacts — requires write + security gate
  app.post('/api/crm/contacts', authMiddleware, requirePermission('contacts:write'), (req, res) => {
    const ctx = buildCtx(req, 'CREATE', 'contact', 'new');
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }

    const { name, email, phone, companyId, tags } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json(fail('name is required'));
      return;
    }
    const contact = contactRepository.create({
      name: name.trim(),
      email: typeof email === 'string' ? email.trim() : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      companyId: typeof companyId === 'string' ? companyId : null,
      tags: Array.isArray(tags) ? tags : [],
    });
    logAudit(ctx, 'ALLOWED', undefined, { contactId: contact.id });
    res.status(201).json(ok(contact));
  });

  // GET /api/crm/contacts/:id
  app.get('/api/crm/contacts/:id', authMiddleware, requirePermission('contacts:read'), (req, res) => {
    const contact = contactRepository.getById(req.params.id);
    if (!contact) { res.status(404).json(fail('contact not found')); return; }
    res.json(ok(contact));
  });

  // PUT /api/crm/contacts/:id
  app.put('/api/crm/contacts/:id', authMiddleware, requirePermission('contacts:write'), (req, res) => {
    const ctx = buildCtx(req, 'UPDATE', 'contact', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const updated = contactRepository.update(req.params.id, req.body ?? {});
    if (!updated) { res.status(404).json(fail('contact not found')); return; }
    logAudit(ctx, 'ALLOWED', undefined, { contactId: updated.id });
    res.json(ok(updated));
  });

  // DELETE /api/crm/contacts/:id — risk-evaluated
  app.delete('/api/crm/contacts/:id', authMiddleware, requirePermission('contacts:delete'), (req, res) => {
    const ctx = buildCtx(req, 'DELETE', 'contact', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const deleted = contactRepository.delete(req.params.id);
    if (!deleted) { res.status(404).json(fail('contact not found')); return; }
    logAudit(ctx, 'ALLOWED', undefined, { contactId: req.params.id });
    res.json(ok(null));
  });
}
