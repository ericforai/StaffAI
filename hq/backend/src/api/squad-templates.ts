/**
 * Squad Templates API Routes
 *
 * Provides HTTP endpoints for squad template management.
 * All routes follow the pattern /api/squad/*
 */

import type express from 'express';
import type { Agent } from '../types';
import {
  createSquadTemplateService,
  type SquadTemplateService,
  type AvailableAgent,
} from '../orchestration/squad-template-service';

/**
 * Squad template route dependencies
 */
export interface SquadTemplateRouteDependencies {
  squadTemplateService: SquadTemplateService;
  getAgent: (id: string) => Agent | undefined;
}

/**
 * Register squad template routes
 */
export function registerSquadTemplateRoutes(
  app: express.Application,
  dependencies: SquadTemplateRouteDependencies
) {
  const { squadTemplateService, getAgent } = dependencies;

  /**
   * GET /api/squad/templates
   *
   * Get all available squad templates.
   *
   * Returns:
   * - templates: SquadTemplate[] - Available squad templates
   */
  app.get('/api/squad/templates', (_req, res) => {
    try {
      const templates = squadTemplateService.listTemplates();

      return res.json({
        templates,
        count: templates.length,
      });
    } catch (error) {
      console.error('[Squad Template API] Failed to list templates:', error);
      return res.status(500).json({
        error: 'Failed to retrieve squad templates',
      });
    }
  });

  /**
   * POST /api/squad/create
   *
   * Create a squad from a template by resolving roles to available agents.
   *
   * Body:
   * - templateName: string - Name of the template to use
   * - agentIds: string[] - Available agent IDs to resolve from
   *
   * Returns:
   * - members: SquadMember[] - Successfully assigned squad members
   * - unfilledRoles: Array<{role, department}> - Roles that could not be filled
   */
  app.post('/api/squad/create', (req, res) => {
    const { templateName, agentIds } = req.body;

    // Validate templateName
    if (typeof templateName !== 'string' || !templateName.trim()) {
      return res.status(400).json({
        error: 'templateName is required and must be a non-empty string',
      });
    }

    // Validate agentIds
    if (!Array.isArray(agentIds)) {
      return res.status(400).json({
        error: 'agentIds is required and must be an array',
      });
    }

    // Build available agents list
    const availableAgents: AvailableAgent[] = [];
    for (const id of agentIds) {
      if (typeof id !== 'string' || !id.trim()) {
        continue;
      }

      const agent = getAgent(id);
      if (!agent) {
        continue;
      }

      availableAgents.push({
        id: agent.id,
        name: agent.frontmatter.name,
        department: agent.department,
        description: agent.frontmatter.description,
      });
    }

    try {
      const result = squadTemplateService.resolveSquad(templateName, availableAgents);

      return res.json({
        templateName,
        members: result.members,
        unfilledRoles: result.unfilledRoles,
        totalMembers: result.members.length,
        unfilledCount: result.unfilledRoles.length,
      });
    } catch (error) {
      console.error('[Squad Template API] Failed to create squad:', error);
      return res.status(500).json({
        error: 'Failed to create squad from template',
      });
    }
  });
}
