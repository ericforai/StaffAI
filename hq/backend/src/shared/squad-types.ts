/**
 * Squad Mode Types
 *
 * Structured Commander/Executor/Critic roles for multi-agent squad execution.
 * Provides pre-configured templates for common team compositions.
 */

/**
 * Individual squad member roles
 * - commander: Leads the squad, makes decisions, coordinates execution
 * - executor: Performs the primary work/implementation
 * - critic: Reviews, validates, and provides quality feedback
 * - coordinator: Manages workflow between squad members
 * - primary: Primary responsibility for a task
 * - secondary: Supporting responsibility
 * - reviewer: Reviews and validates work
 * - dispatcher: Routes tasks to appropriate team members
 */
export type SquadRole =
  | 'commander'
  | 'executor'
  | 'critic'
  | 'coordinator'
  | 'primary'
  | 'secondary'
  | 'reviewer'
  | 'dispatcher';

/**
 * A member of a squad with assigned role
 */
export interface SquadMember {
  agentId: string;
  agentName: string;
  role: SquadRole;
  department: string;
}

/**
 * Role specification within a squad template
 */
export interface SquadRoleSpec {
  role: SquadRole;
  department: string;
  taskTypes: string[];
}

/**
 * A pre-configured squad template
 * Defines the structure and composition of a squad for specific use cases
 */
export interface SquadTemplate {
  name: string;
  description: string;
  roles: SquadRoleSpec[];
}

/**
 * Pre-configured squad templates
 *
 * - dev-team: Standard software development squad
 * - research-team: Research and analysis squad
 * - review-team: Code review and security validation squad
 */
export const SQUAD_TEMPLATES: Record<string, SquadTemplate> = {
  dev_team: {
    name: 'dev_team',
    description: 'Standard software development squad with architecture, implementation, and code review',
    roles: [
      {
        role: 'commander',
        department: 'engineering',
        taskTypes: ['architecture', 'architecture_analysis', 'backend_design', 'frontend_implementation'],
      },
      {
        role: 'executor',
        department: 'engineering',
        taskTypes: ['backend_implementation', 'frontend_implementation', 'code_review'],
      },
      {
        role: 'critic',
        department: 'testing',
        taskTypes: ['code_review', 'quality_assurance'],
      },
    ],
  },
  research_team: {
    name: 'research_team',
    description: 'Research and analysis squad with project management, research, and financial analysis',
    roles: [
      {
        role: 'commander',
        department: 'project-management',
        taskTypes: ['documentation', 'general'],
      },
      {
        role: 'executor',
        department: 'marketing',
        taskTypes: ['documentation', 'general'],
      },
      {
        role: 'critic',
        department: 'paid-media',
        taskTypes: ['documentation', 'general'],
      },
    ],
  },
  review_team: {
    name: 'review_team',
    description: 'Code review and security validation squad with architecture, review, and security expertise',
    roles: [
      {
        role: 'commander',
        department: 'engineering',
        taskTypes: ['architecture_analysis', 'code_review'],
      },
      {
        role: 'executor',
        department: 'testing',
        taskTypes: ['code_review', 'quality_assurance'],
      },
      {
        role: 'critic',
        department: 'engineering',
        taskTypes: ['code_review', 'backend_design'],
      },
    ],
  },
};
