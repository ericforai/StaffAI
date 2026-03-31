import type { Application, Request, Response } from 'express';
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
}
