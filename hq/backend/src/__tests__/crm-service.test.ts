/**
 * CRM Service Tests
 *
 * Tests for ContactService, CompanyService, DealService, ActivityService, DashboardService
 * using in-memory repositories.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryContactRepository,
  createInMemoryCompanyRepository,
  createInMemoryDealRepository,
  createInMemoryActivityRepository,
} from '../persistence/crm-repositories';
import {
  createContactService,
  createCompanyService,
  createDealService,
  createActivityService,
  createDashboardService,
} from '../crm/crm-service';
import type { DealStage } from '../types/crm-types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

async function wait(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1));
}

// ─── Contact Service Tests ─────────────────────────────────────────────────

test('ContactService: create and retrieve a contact', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  const created = await svc.create({
    name: 'Alice Chen',
    email: 'alice@example.com',
    phone: '+1-555-0100',
  });

  assert.ok(created.id.startsWith('contact_'));
  assert.equal(created.name, 'Alice Chen');
  assert.equal(created.email, 'alice@example.com');
  assert.equal(created.phone, '+1-555-0100');
  assert.deepEqual(created.tags, []);
  assert.ok(created.createdAt);

  const found = await svc.getById(created.id);
  assert.ok(found);
  assert.equal(found!.name, 'Alice Chen');
});

test('ContactService: list returns all contacts', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  await svc.create({ name: 'Bob Wang' });
  await svc.create({ name: 'Carol Li' });

  const all = await svc.list();
  assert.equal(all.length, 2);
});

test('ContactService: update modifies contact fields', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  const created = await svc.create({ name: 'Dave Liu' });
  const updated = await svc.update(created.id, {
    name: 'David Liu',
    tags: ['vip'],
  });

  assert.ok(updated);
  assert.equal(updated!.name, 'David Liu');
  assert.deepEqual(updated!.tags, ['vip']);
  // untouched fields preserved
  assert.equal(updated!.email, undefined);
});

test('ContactService: delete removes contact', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  const created = await svc.create({ name: 'Eve Zhang' });
  const deleted = await svc.delete(created.id);
  assert.equal(deleted, true);

  const found = await svc.getById(created.id);
  assert.equal(found, null);
});

test('ContactService: delete non-existent returns false', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  const deleted = await svc.delete('does-not-exist');
  assert.equal(deleted, false);
});

test('ContactService: getWithCompany returns contact with company when linked', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const contactSvc = createContactService(contactRepo, companyRepo);
  const companySvc = createCompanyService(companyRepo);

  const company = await companySvc.create({ name: 'Acme Corp' });
  const contact = await contactSvc.create({
    name: 'Frank Hu',
    companyId: company.id,
  });

  const result = await contactSvc.getWithCompany(contact.id);
  assert.ok(result);
  assert.equal(result!.name, 'Frank Hu');
  assert.ok(result!.company);
  assert.equal(result!.company!.name, 'Acme Corp');
});

test('ContactService: getWithCompany returns undefined company when not linked', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  const contact = await svc.create({ name: 'Grace Wu' });
  const result = await svc.getWithCompany(contact.id);
  assert.ok(result);
  assert.equal(result!.name, 'Grace Wu');
  assert.equal(result!.company, undefined);
});

test('ContactService: getWithCompany returns null for unknown id', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createContactService(contactRepo, companyRepo);

  const result = await svc.getWithCompany('unknown-id');
  assert.equal(result, null);
});

test('ContactService: getByCompanyId filters contacts', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const contactSvc = createContactService(contactRepo, companyRepo);
  const companySvc = createCompanyService(companyRepo);

  const acme = await companySvc.create({ name: 'Acme' });
  const beta = await companySvc.create({ name: 'Beta' });

  await contactSvc.create({ name: 'Alice', companyId: acme.id });
  await contactSvc.create({ name: 'Bob', companyId: acme.id });
  await contactSvc.create({ name: 'Carol', companyId: beta.id });

  const acmeContacts = await contactSvc.getByCompanyId(acme.id);
  assert.equal(acmeContacts.length, 2);
  assert.ok(acmeContacts.every((c) => c.companyId === acme.id));
});

// ─── Company Service Tests ─────────────────────────────────────────────────

test('CompanyService: create and retrieve a company', async () => {
  const repo = createInMemoryCompanyRepository();
  const svc = createCompanyService(repo);

  const created = await svc.create({
    name: 'Nexus Technologies',
    industry: 'SaaS',
    website: 'https://nexus.example.com',
    size: 'medium',
  });

  assert.ok(created.id.startsWith('company_'));
  assert.equal(created.name, 'Nexus Technologies');
  assert.equal(created.industry, 'SaaS');
  assert.equal(created.size, 'medium');

  const found = await svc.getById(created.id);
  assert.ok(found);
  assert.equal(found!.name, 'Nexus Technologies');
});

test('CompanyService: list returns all companies', async () => {
  const repo = createInMemoryCompanyRepository();
  const svc = createCompanyService(repo);

  await svc.create({ name: 'Alpha' });
  await svc.create({ name: 'Beta' });

  const all = await svc.list();
  assert.equal(all.length, 2);
});

test('CompanyService: update modifies company fields', async () => {
  const repo = createInMemoryCompanyRepository();
  const svc = createCompanyService(repo);

  const created = await svc.create({ name: 'Old Name' });
  const updated = await svc.update(created.id, {
    name: 'New Name',
    industry: 'Fintech',
    tags: ['investor'],
  });

  assert.ok(updated);
  assert.equal(updated!.name, 'New Name');
  assert.equal(updated!.industry, 'Fintech');
  assert.deepEqual(updated!.tags, ['investor']);
});

test('CompanyService: delete removes company', async () => {
  const repo = createInMemoryCompanyRepository();
  const svc = createCompanyService(repo);

  const created = await svc.create({ name: 'To Delete' });
  const deleted = await svc.delete(created.id);
  assert.equal(deleted, true);

  const found = await svc.getById(created.id);
  assert.equal(found, null);
});

test('CompanyService: update non-existent returns null', async () => {
  const repo = createInMemoryCompanyRepository();
  const svc = createCompanyService(repo);

  const updated = await svc.update('ghost', { name: 'No-op' });
  assert.equal(updated, null);
});

// ─── Deal Service Tests ───────────────────────────────────────────────────

test('DealService: create and retrieve a deal', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  const created = await svc.create({
    title: 'Enterprise License',
    value: 50000,
    stage: 'proposal',
  });

  assert.ok(created.id.startsWith('deal_'));
  assert.equal(created.title, 'Enterprise License');
  assert.equal(created.value, 50000);
  assert.equal(created.stage, 'proposal');

  const found = await svc.getById(created.id);
  assert.ok(found);
  assert.equal(found!.title, 'Enterprise License');
});

test('DealService: create defaults stage to prospecting', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  const created = await svc.create({ title: 'Small Deal' });
  assert.equal(created.stage, 'prospecting');
});

test('DealService: updateStage changes only stage', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  const created = await svc.create({ title: 'Deal X', value: 1000 });
  const updated = await svc.updateStage(created.id, { stage: 'closed_won' });

  assert.ok(updated);
  assert.equal(updated!.stage, 'closed_won');
  assert.equal(updated!.value, 1000); // unchanged
});

test('DealService: updateStage returns null for unknown id', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  const result = await svc.updateStage('ghost', { stage: 'closed_lost' });
  assert.equal(result, null);
});

test('DealService: getByStage filters deals', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  await svc.create({ title: 'Won 1', stage: 'closed_won' });
  await svc.create({ title: 'Won 2', stage: 'closed_won' });
  await svc.create({ title: 'Lost 1', stage: 'closed_lost' });

  const won = await svc.getByStage('closed_won' as DealStage);
  assert.equal(won.length, 2);
  assert.ok(won.every((d) => d.stage === 'closed_won'));
});

test('DealService: getWithRelations includes contact and company', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const dealSvc = createDealService(dealRepo, contactRepo, companyRepo);
  const contactSvc = createContactService(contactRepo, companyRepo);
  const companySvc = createCompanyService(companyRepo);

  const company = await companySvc.create({ name: 'Globex' });
  const contact = await contactSvc.create({ name: 'Hank', companyId: company.id });
  const deal = await dealSvc.create({
    title: 'Globex Deal',
    contactId: contact.id,
    companyId: company.id,
  });

  const result = await dealSvc.getWithRelations(deal.id);
  assert.ok(result);
  assert.equal(result!.title, 'Globex Deal');
  assert.ok(result!.contact);
  assert.equal(result!.contact!.name, 'Hank');
  assert.ok(result!.company);
  assert.equal(result!.company!.name, 'Globex');
});

test('DealService: getWithRelations returns undefined relations when absent', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  const deal = await svc.create({ title: 'Standalone Deal' });

  const result = await svc.getWithRelations(deal.id);
  assert.ok(result);
  assert.equal(result!.contact, undefined);
  assert.equal(result!.company, undefined);
});

test('DealService: delete removes deal', async () => {
  const dealRepo = createInMemoryDealRepository();
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const svc = createDealService(dealRepo, contactRepo, companyRepo);

  const created = await svc.create({ title: 'To Remove' });
  const deleted = await svc.delete(created.id);
  assert.equal(deleted, true);

  const found = await svc.getById(created.id);
  assert.equal(found, null);
});

// ─── Activity Service Tests ────────────────────────────────────────────────

test('ActivityService: create and retrieve an activity', async () => {
  const repo = createInMemoryActivityRepository();
  const svc = createActivityService(repo);

  const created = await svc.create({
    type: 'call',
    subject: 'Intro call with Ivana',
    body: 'Discussed pricing.',
    contactId: 'c1',
  });

  assert.ok(created.id.startsWith('activity_'));
  assert.equal(created.type, 'call');
  assert.equal(created.subject, 'Intro call with Ivana');
  assert.equal(created.contactId, 'c1');

  const found = await svc.getById(created.id);
  assert.ok(found);
  assert.equal(found!.subject, 'Intro call with Ivana');
});

test('ActivityService: list returns all activities', async () => {
  const repo = createInMemoryActivityRepository();
  const svc = createActivityService(repo);

  await svc.create({ type: 'email', subject: 'Email 1' });
  await svc.create({ type: 'meeting', subject: 'Meeting 1' });

  const all = await svc.list();
  assert.equal(all.length, 2);
});

test('ActivityService: getByContactId filters correctly', async () => {
  const repo = createInMemoryActivityRepository();
  const svc = createActivityService(repo);

  await svc.create({ type: 'call', subject: 'Call A', contactId: 'c1' });
  await svc.create({ type: 'email', subject: 'Email A', contactId: 'c1' });
  await svc.create({ type: 'note', subject: 'Note B', contactId: 'c2' });

  const c1 = await svc.getByContactId('c1');
  assert.equal(c1.length, 2);
});

test('ActivityService: getByCompanyId filters correctly', async () => {
  const repo = createInMemoryActivityRepository();
  const svc = createActivityService(repo);

  await svc.create({ type: 'call', subject: 'Call Comp1', companyId: 'co1' });
  await svc.create({ type: 'note', subject: 'Note Comp2', companyId: 'co2' });

  const co1 = await svc.getByCompanyId('co1');
  assert.equal(co1.length, 1);
  assert.equal(co1[0].subject, 'Call Comp1');
});

test('ActivityService: getByDealId filters correctly', async () => {
  const repo = createInMemoryActivityRepository();
  const svc = createActivityService(repo);

  await svc.create({ type: 'meeting', subject: 'Demo Deal1', dealId: 'd1' });
  await svc.create({ type: 'note', subject: 'Note Deal2', dealId: 'd2' });

  const d1 = await svc.getByDealId('d1');
  assert.equal(d1.length, 1);
  assert.equal(d1[0].dealId, 'd1');
});

test('ActivityService: delete removes activity', async () => {
  const repo = createInMemoryActivityRepository();
  const svc = createActivityService(repo);

  const created = await svc.create({ type: 'note', subject: 'To Remove' });
  const deleted = await svc.delete(created.id);
  assert.equal(deleted, true);

  const found = await svc.getById(created.id);
  assert.equal(found, null);
});

// ─── Dashboard Service Tests ───────────────────────────────────────────────

test('DashboardService: getDashboard returns correct counts', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const dealRepo = createInMemoryDealRepository();
  const activityRepo = createInMemoryActivityRepository();

  const contactSvc = createContactService(contactRepo, companyRepo);
  const companySvc = createCompanyService(companyRepo);
  const dealSvc = createDealService(dealRepo, contactRepo, companyRepo);
  const activitySvc = createActivityService(activityRepo);
  const dashboardSvc = createDashboardService(
    contactRepo,
    companyRepo,
    dealRepo,
    activityRepo
  );

  await contactSvc.create({ name: 'Alice' });
  await contactSvc.create({ name: 'Bob' });
  await companySvc.create({ name: 'Acme' });
  await dealSvc.create({ title: 'Deal 1', value: 10000 });
  await dealSvc.create({ title: 'Deal 2', value: 20000, stage: 'closed_won' });
  await dealSvc.create({ title: 'Deal 3', value: 5000, stage: 'proposal' });
  await activitySvc.create({ type: 'call', subject: 'Call 1' });

  const dash = await dashboardSvc.getDashboard();

  assert.equal(dash.contactCount, 2);
  assert.equal(dash.companyCount, 1);
  assert.equal(dash.dealCount, 3);
  assert.equal(dash.totalPipelineValue, 35000);
  assert.equal(dash.stageBreakdown.prospecting.count, 1);
  assert.equal(dash.stageBreakdown.prospecting.value, 10000);
  assert.equal(dash.stageBreakdown.closed_won.count, 1);
  assert.equal(dash.stageBreakdown.closed_won.value, 20000);
  assert.equal(dash.stageBreakdown.proposal.count, 1);
  assert.equal(dash.stageBreakdown.proposal.value, 5000);
  assert.equal(dash.recentActivities.length, 1);
  assert.equal(dash.topDeals.length, 3);
});

test('DashboardService: getDashboard returns empty counts on fresh repos', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const dealRepo = createInMemoryDealRepository();
  const activityRepo = createInMemoryActivityRepository();
  const dashboardSvc = createDashboardService(
    contactRepo,
    companyRepo,
    dealRepo,
    activityRepo
  );

  const dash = await dashboardSvc.getDashboard();

  assert.equal(dash.contactCount, 0);
  assert.equal(dash.companyCount, 0);
  assert.equal(dash.dealCount, 0);
  assert.equal(dash.totalPipelineValue, 0);
  assert.equal(dash.stageBreakdown.closed_won.count, 0);
  assert.equal(dash.recentActivities.length, 0);
  assert.equal(dash.topDeals.length, 0);
});

test('DashboardService: topDeals sorted by value desc, limited to 10', async () => {
  const contactRepo = createInMemoryContactRepository();
  const companyRepo = createInMemoryCompanyRepository();
  const dealRepo = createInMemoryDealRepository();
  const activityRepo = createInMemoryActivityRepository();
  const dealSvc = createDealService(dealRepo, contactRepo, companyRepo);
  const dashboardSvc = createDashboardService(
    contactRepo,
    companyRepo,
    dealRepo,
    activityRepo
  );

  // create 15 deals
  for (let i = 0; i < 15; i++) {
    await dealSvc.create({ title: `Deal ${i}`, value: i * 1000 });
  }

  const dash = await dashboardSvc.getDashboard();

  assert.equal(dash.topDeals.length, 10);
  // verify descending
  for (let i = 0; i < dash.topDeals.length - 1; i++) {
    const current = dash.topDeals[i];
    const next = dash.topDeals[i + 1];
    if (current && next) {
      const v1 = current.value ?? 0;
      const v2 = next.value ?? 0;
      assert.ok(
        v1 >= v2,
        `Deal[${i}] value ${v1} should be >= Deal[${i + 1}] ${v2}`
      );
    }
  }
});
