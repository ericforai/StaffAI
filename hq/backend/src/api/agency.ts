import type express from 'express';
import { registerAgentRoutes } from './agents';
import { registerSkillRoutes } from './skills';
import { registerSquadRoutes } from './squad';
import { registerTemplateRoutes } from './templates';
import type { AgentRouteDependencies } from './agents';
import type { SkillRouteDependencies } from './skills';
import type { SquadRouteDependencies } from './squad';
import type { TemplateRouteDependencies } from './templates';

type AgencyRouteDependencies = AgentRouteDependencies &
  SkillRouteDependencies &
  SquadRouteDependencies &
  TemplateRouteDependencies;

export function registerAgencyRoutes(app: express.Application, dependencies: AgencyRouteDependencies) {
  registerAgentRoutes(app, dependencies);
  registerSkillRoutes(app, dependencies);
  registerSquadRoutes(app, dependencies);
  registerTemplateRoutes(app, dependencies);
}
