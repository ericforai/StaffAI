import type express from 'express';
import type { Store } from '../store';
import { randomUUID } from 'node:crypto';
import type { OKRRecord } from '../shared/intent-types';

export function registerOkrRoutes(app: express.Application, store: Store) {
  // GET /api/okrs - List all OKRs
  app.get('/api/okrs', async (_req, res) => {
    try {
      const okrs = await store.getOKRs();
      return res.json(okrs);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch OKRs' });
    }
  });

  // GET /api/okrs/:id - Get specific OKR
  app.get('/api/okrs/:id', async (req, res) => {
    try {
      const okr = await store.getOKRById(req.params.id);
      if (!okr) return res.status(404).json({ error: 'OKR not found' });
      return res.json(okr);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch OKR' });
    }
  });

  // POST /api/okrs - Create new OKR
  app.post('/api/okrs', async (req, res) => {
    try {
      const { objective, keyResults } = req.body;
      if (!objective || !Array.isArray(keyResults)) {
        return res.status(400).json({ error: 'Objective and Key Results array required' });
      }

      const now = new Date().toISOString();
      const okr: OKRRecord = {
        id: `okr_${randomUUID()}`,
        objective,
        keyResults: keyResults.map((kr: any) => ({
          id: kr.id || `kr_${randomUUID()}`,
          description: kr.description,
          targetValue: kr.targetValue,
          currentValueValue: kr.currentValueValue || 0,
          metricKey: kr.metricKey || 'custom',
          unit: kr.unit || '',
          status: kr.status || 'on_track',
        })),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await store.saveOKR(okr);
      return res.status(201).json(okr);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create OKR' });
    }
  });

  // PATCH /api/okrs/:id - Update OKR or KR values
  app.patch('/api/okrs/:id', async (req, res) => {
    try {
      const okrId = req.params.id;
      const updates = req.body;

      const updated = await store.updateOKR(okrId, (current) => ({
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      }));

      if (!updated) return res.status(404).json({ error: 'OKR not found' });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update OKR' });
    }
  });

  // DELETE /api/okrs/:id
  app.delete('/api/okrs/:id', async (req, res) => {
    try {
      // Assuming store has deleteOKR, if not we'll add it or mark as cancelled
      await store.updateOKR(req.params.id, (current) => ({
        ...current,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      }));
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete OKR' });
    }
  });
}
