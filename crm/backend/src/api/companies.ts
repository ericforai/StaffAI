import type express from 'express';
import { companyRepository } from '../persistence/repositories';
import { ok, fail } from '../types';
import {
  authMiddleware,
  requirePermission,
  securityGate,
  buildCtx,
  logAudit,
} from '../middleware/security';

export function registerCompanyRoutes(app: express.Application): void {

  // GET /api/crm/companies
  app.get('/api/crm/companies', authMiddleware, requirePermission('companies:read'), (_req, res) => {
    res.json(ok(companyRepository.list()));
  });

  // POST /api/crm/companies
  app.post('/api/crm/companies', authMiddleware, requirePermission('companies:write'), (req, res) => {
    const ctx = buildCtx(req, 'CREATE', 'company', 'new');
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const { name, industry, website, address } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json(fail('name is required'));
      return;
    }
    const company = companyRepository.create({
      name: name.trim(),
      industry: typeof industry === 'string' ? industry.trim() : '',
      website: typeof website === 'string' ? website.trim() : '',
      address: typeof address === 'string' ? address.trim() : '',
    });
    logAudit(ctx, 'ALLOWED', undefined, { companyId: company.id });
    res.status(201).json(ok(company));
  });

  // GET /api/crm/companies/:id
  app.get('/api/crm/companies/:id', authMiddleware, requirePermission('companies:read'), (req, res) => {
    const company = companyRepository.getById(req.params.id);
    if (!company) { res.status(404).json(fail('company not found')); return; }
    res.json(ok(company));
  });

  // PUT /api/crm/companies/:id
  app.put('/api/crm/companies/:id', authMiddleware, requirePermission('companies:write'), (req, res) => {
    const ctx = buildCtx(req, 'UPDATE', 'company', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const updated = companyRepository.update(req.params.id, req.body ?? {});
    if (!updated) { res.status(404).json(fail('company not found')); return; }
    logAudit(ctx, 'ALLOWED', undefined, { companyId: updated.id });
    res.json(ok(updated));
  });

  // DELETE /api/crm/companies/:id — risk-evaluated
  app.delete('/api/crm/companies/:id', authMiddleware, requirePermission('companies:delete'), (req, res) => {
    const ctx = buildCtx(req, 'DELETE', 'company', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const deleted = companyRepository.delete(req.params.id);
    if (!deleted) { res.status(404).json(fail('company not found')); return; }
    logAudit(ctx, 'ALLOWED', undefined, { companyId: req.params.id });
    res.json(ok(null));
  });
}
