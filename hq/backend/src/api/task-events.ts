import type express from 'express';
import type { TaskDashboardEvent } from '../observability/task-events';

interface TaskEventRouteDependencies {
  taskEventFeed: Array<TaskDashboardEvent & { timestamp: string }>;
}

export function registerTaskEventRoutes(app: express.Application, dependencies: TaskEventRouteDependencies) {
  app.get('/api/task-events', (_req, res) => {
    return res.json({
      events: dependencies.taskEventFeed,
    });
  });
}
