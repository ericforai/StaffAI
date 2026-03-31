import type { Application, Request, Response } from 'express';
import { z } from 'zod';
import {
  ContactService,
  CompanyService,
  DealService,
  ActivityService,
  DashboardService,
} from '../crm/crm-service';
import {
  CreateContactSchema,
  CreateCompanySchema,
  CreateDealSchema,
  UpdateDealStageSchema,
  CreateActivitySchema,
  DEAL_STAGES,
  ACTIVITY_TYPES,
} from '../types/crm-types';

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error('[CRM Routes]', err);
      res.status(500).json({ success: false, error: String(err) });
    });
  };
}

export function registerCrmRoutes(
  app: Application,
  services: {
    contactService: ContactService;
    companyService: CompanyService;
    dealService: DealService;
    activityService: ActivityService;
    dashboardService: DashboardService;
  }
) {
  const { contactService, companyService, dealService, activityService, dashboardService } = services;

  // ─── Constants ───────────────────────────────────────────────────────────────
  app.get('/api/crm/constants', asyncHandler(async (_req, res) => {
    res.json({
      DEAL_STAGES,
      ACTIVITY_TYPES,
    });
  }));

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  app.get('/api/crm/dashboard', asyncHandler(async (_req, res) => {
    const data = await dashboardService.getDashboard();
    res.json({ success: true, data });
  }));

  // ─── Contacts ────────────────────────────────────────────────────────────────
  app.get('/api/crm/contacts', asyncHandler(async (_req, res) => {
    const contacts = await contactService.list();
    res.json({ success: true, data: contacts, meta: { total: contacts.length } });
  }));

  app.get('/api/crm/contacts/:id', asyncHandler(async (req, res) => {
    const contact = await contactService.getWithCompany(req.params['id'] as string);
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }
    res.json({ success: true, data: contact });
  }));

  app.post('/api/crm/contacts', asyncHandler(async (req, res) => {
    const input = CreateContactSchema.parse(req.body);
    const contact = await contactService.create(input);
    res.status(201).json({ success: true, data: contact });
  }));

  app.put('/api/crm/contacts/:id', asyncHandler(async (req, res) => {
    const input = CreateContactSchema.partial().parse(req.body);
    const contact = await contactService.update(req.params['id'] as string, input);
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }
    res.json({ success: true, data: contact });
  }));

  app.delete('/api/crm/contacts/:id', asyncHandler(async (req, res) => {
    const deleted = await contactService.delete(req.params['id'] as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }
    res.json({ success: true });
  }));

  app.get('/api/crm/contacts/by-company/:companyId', asyncHandler(async (req, res) => {
    const contacts = await contactService.getByCompanyId(req.params['companyId'] as string);
    res.json({ success: true, data: contacts });
  }));

  // ─── Companies ──────────────────────────────────────────────────────────────
  app.get('/api/crm/companies', asyncHandler(async (_req, res) => {
    const companies = await companyService.list();
    res.json({ success: true, data: companies, meta: { total: companies.length } });
  }));

  app.get('/api/crm/companies/:id', asyncHandler(async (req, res) => {
    const company = await companyService.getById(req.params['id'] as string);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }
    res.json({ success: true, data: company });
  }));

  app.post('/api/crm/companies', asyncHandler(async (req, res) => {
    const input = CreateCompanySchema.parse(req.body);
    const company = await companyService.create(input);
    res.status(201).json({ success: true, data: company });
  }));

  app.put('/api/crm/companies/:id', asyncHandler(async (req, res) => {
    const input = CreateCompanySchema.partial().parse(req.body);
    const company = await companyService.update(req.params['id'] as string, input);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }
    res.json({ success: true, data: company });
  }));

  app.delete('/api/crm/companies/:id', asyncHandler(async (req, res) => {
    const deleted = await companyService.delete(req.params['id'] as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }
    res.json({ success: true });
  }));

  // ─── Deals ───────────────────────────────────────────────────────────────────
  app.get('/api/crm/deals', asyncHandler(async (req, res) => {
    const stage = req.query['stage'] as string | undefined;
    const deals = stage ? await dealService.getByStage(stage as any) : await dealService.list();
    res.json({ success: true, data: deals, meta: { total: deals.length } });
  }));

  app.get('/api/crm/deals/:id', asyncHandler(async (req, res) => {
    const deal = await dealService.getWithRelations(req.params['id'] as string);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }
    res.json({ success: true, data: deal });
  }));

  app.post('/api/crm/deals', asyncHandler(async (req, res) => {
    const input = CreateDealSchema.parse(req.body);
    const deal = await dealService.create(input);
    res.status(201).json({ success: true, data: deal });
  }));

  app.patch('/api/crm/deals/:id/stage', asyncHandler(async (req, res) => {
    const input = UpdateDealStageSchema.parse(req.body);
    const deal = await dealService.updateStage(req.params['id'] as string, input);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }
    res.json({ success: true, data: deal });
  }));

  app.put('/api/crm/deals/:id', asyncHandler(async (req, res) => {
    const input = CreateDealSchema.partial().parse(req.body);
    const deal = await dealService.update(req.params['id'] as string, input);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }
    res.json({ success: true, data: deal });
  }));

  app.delete('/api/crm/deals/:id', asyncHandler(async (req, res) => {
    const deleted = await dealService.delete(req.params['id'] as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }
    res.json({ success: true });
  }));

  // ─── Activities ──────────────────────────────────────────────────────────────
  app.get('/api/crm/activities', asyncHandler(async (req, res) => {
    const { contactId, companyId, dealId } = req.query as Record<string, string | undefined>;
    let activities;
    if (contactId) activities = await activityService.getByContactId(contactId);
    else if (companyId) activities = await activityService.getByCompanyId(companyId);
    else if (dealId) activities = await activityService.getByDealId(dealId);
    else activities = await activityService.list();
    res.json({ success: true, data: activities, meta: { total: activities.length } });
  }));

  app.post('/api/crm/activities', asyncHandler(async (req, res) => {
    const input = CreateActivitySchema.parse(req.body);
    const activity = await activityService.create(input);
    res.status(201).json({ success: true, data: activity });
  }));

  app.delete('/api/crm/activities/:id', asyncHandler(async (req, res) => {
    const deleted = await activityService.delete(req.params['id'] as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Activity not found' });
      return;
    }
    res.json({ success: true });
  }));
}
