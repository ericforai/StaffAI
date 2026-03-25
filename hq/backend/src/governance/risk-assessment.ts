/**
 * Risk Assessment Engine
 *
 * Evaluates task requests for potential risks and determines approval requirements.
 * Supports configurable rules with weighted scoring.
 */

/**
 * Risk levels for task assessment
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Input for risk assessment
 */
export interface RiskAssessmentInput {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Optional task type */
  taskType?: string;
  /** Optional execution mode */
  executionMode?: string;
  /** Optional priority */
  priority?: string;
}

/**
 * Result of risk assessment
 */
export interface RiskAssessmentResult {
  /** Calculated risk level */
  riskLevel: RiskLevel;
  /** Whether approval is required */
  approvalRequired: boolean;
  /** Factors contributing to risk assessment */
  factors: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Risk policy rule configuration
 */
export interface RiskPolicyRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Condition function to evaluate input */
  condition: (input: RiskAssessmentInput) => boolean;
  /** Risk level when condition matches */
  riskLevel: RiskLevel;
  /** Description of risk factor */
  factor: string;
  /** Rule weight for scoring (higher = more influence) */
  weight: number;
}

/**
 * Risk score thresholds
 */
const RISK_THRESHOLDS = {
  HIGH: 7,
  MEDIUM: 4,
  LOW: 0
} as const;

/**
 * Confidence levels based on factor count
 */
function calculateConfidence(matchedFactors: number, totalEnabledRules: number): number {
  if (totalEnabledRules === 0) return 0.5;
  const ratio = matchedFactors / totalEnabledRules;
  // More matches = higher confidence, min 0.3, max 1.0
  return Math.min(0.3 + ratio * 0.7, 1.0);
}

/**
 * Risk Assessment Engine
 *
 * Evaluates task inputs against configured rules to determine risk level.
 */
export class RiskAssessmentEngine {
  private rules: Map<string, RiskPolicyRule>;

  constructor(rules?: RiskPolicyRule[]) {
    this.rules = new Map();
    if (rules) {
      for (const rule of rules) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  /**
   * Assess risk for a given input
   */
  assess(input: RiskAssessmentInput): RiskAssessmentResult {
    const factors: string[] = [];
    let totalScore = 0;
    let enabledCount = 0;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      enabledCount++;

      try {
        if (rule.condition(input)) {
          factors.push(rule.factor);
          totalScore += rule.weight;
        }
      } catch {
        // Skip rules that throw errors
        continue;
      }
    }

    // Determine risk level based on score
    let riskLevel: RiskLevel;
    if (totalScore >= RISK_THRESHOLDS.HIGH) {
      riskLevel = 'HIGH';
    } else if (totalScore >= RISK_THRESHOLDS.MEDIUM) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    // Approval required for MEDIUM and HIGH
    const approvalRequired = riskLevel !== 'LOW';

    return {
      riskLevel,
      approvalRequired,
      factors,
      confidence: calculateConfidence(factors.length, enabledCount)
    };
  }

  /**
   * Add a new rule
   */
  addRule(rule: RiskPolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Enable a rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  /**
   * Disable a rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  /**
   * Get all rules
   */
  getRules(): RiskPolicyRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule by ID
   */
  getRule(ruleId: string): RiskPolicyRule | undefined {
    const rule = this.rules.get(ruleId);
    return rule ? { ...rule } : undefined;
  }
}

/**
 * Default risk rules
 *
 * These rules cover common scenarios:
 * - HIGH risk: destructive operations, production changes, critical systems
 * - MEDIUM risk: complex execution modes, urgent priorities
 * - LOW risk: documentation, general tasks
 */
export function getDefaultRiskRules(): RiskPolicyRule[] {
  return [
    {
      id: 'high-destructive-keywords',
      name: 'Destructive Operation Keywords',
      enabled: true,
      condition: (input): boolean => {
        const text = `${input.title} ${input.description}`.toLowerCase();
        const destructiveKeywords = ['delete', 'remove', 'destroy', 'drop', 'purge', 'wipe'];
        return destructiveKeywords.some(keyword => text.includes(keyword));
      },
      riskLevel: 'HIGH',
      factor: 'Contains destructive operation keywords',
      weight: 8
    },
    {
      id: 'high-production-keywords',
      name: 'Production Environment Keywords',
      enabled: true,
      condition: (input): boolean => {
        const text = `${input.title} ${input.description}`.toLowerCase();
        return text.includes('production') || text.includes('prod') || text.includes('live');
      },
      riskLevel: 'HIGH',
      factor: 'Involves production environment',
      weight: 10
    },
    {
      id: 'high-critical-keywords',
      name: 'Critical System Keywords',
      enabled: true,
      condition: (input): boolean => {
        const text = `${input.title} ${input.description}`.toLowerCase();
        return text.includes('critical') || text.includes('essential') || text.includes('core system');
      },
      riskLevel: 'HIGH',
      factor: 'Affects critical systems',
      weight: 9
    },
    {
      id: 'high-database-keywords',
      name: 'Database Destructive Operations',
      enabled: true,
      condition: (input): boolean => {
        const text = `${input.title} ${input.description}`.toLowerCase();
        const dbDestructive = ['truncate', 'alter table', 'drop table', 'delete from'];
        return dbDestructive.some(op => text.includes(op));
      },
      riskLevel: 'HIGH',
      factor: 'Database destructive operation',
      weight: 10
    },
    {
      id: 'medium-advanced-discussion',
      name: 'Advanced Discussion Mode',
      enabled: true,
      condition: (input): boolean => {
        return input.executionMode === 'advanced_discussion' ||
               input.executionMode === 'require_sampling';
      },
      riskLevel: 'MEDIUM',
      factor: 'Uses advanced discussion mode',
      weight: 5
    },
    {
      id: 'medium-urgent-priority',
      name: 'Urgent Priority',
      enabled: true,
      condition: (input): boolean => {
        return input.priority?.toLowerCase() === 'urgent' ||
               input.priority?.toLowerCase() === 'critical';
      },
      riskLevel: 'MEDIUM',
      factor: 'High urgency priority',
      weight: 4
    },
    {
      id: 'medium-complex-task',
      name: 'Complex Task Type',
      enabled: true,
      condition: (input): boolean => {
        const complexTypes = ['refactor', 'migration', 'integration', 'architecture'];
        return complexTypes.some(type =>
          input.taskType?.toLowerCase().includes(type) ||
          input.title.toLowerCase().includes(type)
        );
      },
      riskLevel: 'MEDIUM',
      factor: 'Complex task type detected',
      weight: 5
    },
    {
      id: 'low-documentation',
      name: 'Documentation Task',
      enabled: true,
      condition: (input): boolean => {
        const text = `${input.title} ${input.description}`.toLowerCase();
        return text.includes('documentation') ||
               text.includes('readme') ||
               text.includes('docs update') ||
               input.taskType?.toLowerCase() === 'documentation';
      },
      riskLevel: 'LOW',
      factor: 'Documentation task',
      weight: -3
    },
    {
      id: 'low-general-task',
      name: 'General Task Type',
      enabled: true,
      condition: (input): boolean => {
        return input.taskType?.toLowerCase() === 'general' ||
               input.taskType?.toLowerCase() === 'routine';
      },
      riskLevel: 'LOW',
      factor: 'General routine task',
      weight: -2
    },
    {
      id: 'low-query-keywords',
      name: 'Query/Read Operations',
      enabled: true,
      condition: (input): boolean => {
        const text = `${input.title} ${input.description}`.toLowerCase();
        const queryKeywords = ['get', 'fetch', 'query', 'read', 'list', 'show', 'display'];
        const hasQueryKeyword = queryKeywords.some(kw => text.startsWith(kw) || text.includes(` ${kw}`));
        // Only apply if no destructive keywords present
        const hasDestructive = ['delete', 'remove', 'drop'].some(kw => text.includes(kw));
        return hasQueryKeyword && !hasDestructive;
      },
      riskLevel: 'LOW',
      factor: 'Read-only operation',
      weight: -2
    }
  ];
}

/**
 * Create a default risk assessment engine with standard rules
 */
export function createDefaultRiskAssessmentEngine(): RiskAssessmentEngine {
  return new RiskAssessmentEngine(getDefaultRiskRules());
}
