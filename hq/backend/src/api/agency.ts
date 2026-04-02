import type express from 'express';
import { registerAgentRoutes } from './agents';
import { registerSkillRoutes } from './skills';
import { registerSquadRoutes } from './squad';
import { registerTemplateRoutes } from './templates';
import type { AgentRouteDependencies } from './agents';
import type { SkillRouteDependencies } from './skills';
import type { SquadRouteDependencies } from './squad';
import type { TemplateRouteDependencies } from './templates';
import type { UserContextService } from '../identity/user-context.js';

type AgencyRouteDependencies = AgentRouteDependencies &
  SkillRouteDependencies &
  SquadRouteDependencies &
  TemplateRouteDependencies & {
    userContextService?: UserContextService;
  };

export function registerAgencyRoutes(app: express.Application, dependencies: AgencyRouteDependencies) {
  registerAgentRoutes(app, {
    scanner: dependencies.scanner,
    store: dependencies.store,
    userContextService: dependencies.userContextService,
  });
  registerSkillRoutes(app, dependencies);
  registerSquadRoutes(app, dependencies);
  registerTemplateRoutes(app, dependencies);
}
