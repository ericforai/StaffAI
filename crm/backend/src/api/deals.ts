import type express from 'express';
import { dealRepository } from '../persistence/repositories';
import { ok, fail } from '../types';
import type { DealStage } from '../types';
import {
  authMiddleware,
  requirePermission,
  securityGate,
  buildCtx,
  logAudit,
} from '../middleware/security';

const VALID_STAGES: DealStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
];

export function registerDealRoutes(app: express.Application): void {

  // GET /api/crm/deals
  app.get('/api/crm/deals', authMiddleware, requirePermission('deals:read'), (_req, res) => {
    res.json(ok(dealRepository.list()));
  });

  // POST /api/crm/deals
  app.post('/api/crm/deals', authMiddleware, requirePermission('deals:write'), (req, res) => {
    const ctx = buildCtx(req, 'CREATE', 'deal', 'new');
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const { title, companyId, contactId, amount, stage, probability, closeDate } = req.body ?? {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json(fail('title is required'));
      return;
    }
    if (!companyId || typeof companyId !== 'string') {
      res.status(400).json(fail('companyId is required'));
      return;
    }
    const parsedStage: DealStage = VALID_STAGES.includes(stage) ? stage : 'lead';
    const parsedAmount = typeof amount === 'number' && amount >= 0 ? amount : 0;
    const parsedProbability =
      typeof probability === 'number' && probability >= 0 && probability <= 100 ? probability : 0;
    const deal = dealRepository.create({
      title: title.trim(),
      companyId,
      contactId: typeof contactId === 'string' ? contactId : '',
      amount: parsedAmount,
      stage: parsedStage,
      probability: parsedProbability,
      closeDate: typeof closeDate === 'string' ? closeDate : '',
    });
    logAudit(ctx, 'ALLOWED', undefined, { dealId: deal.id });
    res.status(201).json(ok(deal));
  });

  // GET /api/crm/deals/:id
  app.get('/api/crm/deals/:id', authMiddleware, requirePermission('deals:read'), (req, res) => {
    const deal = dealRepository.getById(req.params.id);
    if (!deal) { res.status(404).json(fail('deal not found')); return; }
    res.json(ok(deal));
  });

  // PUT /api/crm/deals/:id
  app.put('/api/crm/deals/:id', authMiddleware, requirePermission('deals:write'), (req, res) => {
    const ctx = buildCtx(req, 'UPDATE', 'deal', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const body = req.body ?? {};
    if (body.stage !== undefined && !VALID_STAGES.includes(body.stage)) {
      res.status(400).json(fail('invalid stage value'));
      return;
    }
    const updated = dealRepository.update(req.params.id, body);
    if (!updated) { res.status(404).json(fail('deal not found')); return; }
    logAudit(ctx, 'ALLOWED', undefined, { dealId: updated.id });
    res.json(ok(updated));
  });

  // DELETE /api/crm/deals/:id — HIGH risk
  app.delete('/api/crm/deals/:id', authMiddleware, requirePermission('deals:delete'), (req, res) => {
    const ctx = buildCtx(req, 'DELETE', 'deal', req.params.id);
    const blocked = securityGate(ctx);
    if (blocked) {
      res.status(blocked.status).json({ success: false, error: blocked.entry.reason, auditId: blocked.entry.id });
      return;
    }
    const deleted = dealRepository.delete(req.params.id);
    if (!deleted) { res.status(404).json(fail('deal not found')); return; }
    logAudit(ctx, 'ALLOWED', undefined, { dealId: req.params.id });
    res.json(ok(null));
  });
}
