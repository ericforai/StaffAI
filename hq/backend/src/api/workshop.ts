import type { Application, Request, Response } from 'express';
import http from 'node:http';
import { WorkshopRegistration, WorkshopRegistrationResponse } from '../shared/workshop-types';
import { WorkshopRegistry } from '../orchestration/workshop-registry';

export function registerWorkshopRoutes(app: Application) {
  const registry = WorkshopRegistry.getInstance();

  app.post('/api/workshop/register', (req: Request, res: Response) => {
    const registration = req.body as WorkshopRegistration;
    
    registry.register(registration);
    
    const response: WorkshopRegistrationResponse = {
      status: 'success',
      workshop: registration,
    };

    res.json(response);
  });

  app.get('/api/workshop/list', (_req: Request, res: Response) => {
    res.json({
      workshops: registry.list(),
    });
  });

  app.get('/api/workshop/proxy-stream', (req: Request, res: Response) => {
    const { workshopUrl } = req.query;
    if (!workshopUrl || typeof workshopUrl !== 'string') {
      res.status(400).json({ error: 'workshopUrl is required' });
      return;
    }

    // For testing, we allow any URL, but in production we should validate against registered workshops
    try {
      const targetUrl = new URL('/api/v1/tasks/stream', workshopUrl);

      const proxyReq = http.request(targetUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[Workshop Proxy] Error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Workshop proxy connection failed' });
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        proxyReq.destroy();
      });

      proxyReq.end();
    } catch (err) {
      res.status(400).json({ error: 'Invalid workshopUrl' });
    }
  });
}
