import type { Application, Request, Response } from 'express';
import { WorkshopRegistration, WorkshopRegistrationResponse } from '../shared/workshop-types';

export function registerWorkshopRoutes(app: Application) {
  app.post('/api/workshop/register', (req: Request, res: Response) => {
    const { url, capabilities } = req.body as WorkshopRegistration;
    
    const response: WorkshopRegistrationResponse = {
      status: 'success',
      workshop: {
        url,
        capabilities,
        registered_at: new Date().toISOString(),
      },
    };

    res.json(response);
  });
}
