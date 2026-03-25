/**
 * MVP Preset API Routes
 *
 * GET  /api/presets              — list available MVP presets
 * POST /api/presets/:name/activate  — activate a preset (bulk-hire agents)
 * POST /api/presets/deactivate      — clear the active squad
 */

import type express from 'express';
import type { Store } from '../store';
import type { Scanner } from '../scanner';
import {
  getAvailablePresets,
  getPresetByName,
  activatePreset,
  deactivatePreset,
  PresetNotFoundError,
} from '../orchestration/mvp-preset';

export function registerPresetRoutes(
  app: express.Application,
  store: Store,
  scanner: Scanner,
) {
  app.get('/api/presets', (_req, res) => {
    const presets = getAvailablePresets();
    return res.json({ presets });
  });

  app.post('/api/presets/deactivate', (_req, res) => {
    deactivatePreset(store);
    return res.json({ message: '已清空所有在职员工', activeAgentIds: [] });
  });

  app.post('/api/presets/:name/activate', (req, res) => {
    const presetName = req.params.name;

    try {
      const result = activatePreset(presetName, store, scanner);
      return res.json({
        preset: result.preset,
        hired: result.hired,
        alreadyActive: result.alreadyActive,
        missing: result.missing,
        activeAgentIds: store.getActiveIds(),
      });
    } catch (err) {
      if (err instanceof PresetNotFoundError) {
        return res.status(404).json({ error: `Preset not found: ${presetName}` });
      }
      throw err;
    }
  });
}
