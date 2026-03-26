/**
 * Tests for Risk Assessment Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RiskAssessmentEngine,
  getDefaultRiskRules,
  createDefaultRiskAssessmentEngine,
  type RiskAssessmentInput,
  type RiskPolicyRule
} from '../governance/risk-assessment';

test('RiskAssessmentEngine - default risk assessment for benign input', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Update documentation',
    description: 'Add comments to the utils file'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
  assert.ok(result.confidence > 0);
  assert.ok(Array.isArray(result.factors));
});

test('RiskAssessmentEngine - documentation tasks as LOW risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Update README',
    description: 'Add installation instructions',
    taskType: 'documentation'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
});

test('RiskAssessmentEngine - general tasks as LOW risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Routine check',
    description: 'Check system status',
    taskType: 'general'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
});

test('RiskAssessmentEngine - destructive keywords as HIGH risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const destructiveInputs = [
    { title: 'Delete user data', description: 'Remove all user records' },
    { title: 'Clean up', description: 'Destroy old containers' },
    { title: 'Database cleanup', description: 'Drop unused tables' },
    { title: 'Purge logs', description: 'Wipe old log files' },
    { title: 'Remove feature flag', description: 'Delete flag from config' }
  ];

  for (const input of destructiveInputs) {
    const result = engine.assess(input);
    assert.equal(result.riskLevel, 'HIGH');
    assert.equal(result.approvalRequired, true);
    assert.ok(
      result.factors.some(f => f.includes('destructive') || f.includes('operation') || f.includes('database'))
      );
  }
});

test('RiskAssessmentEngine - Chinese destructive and production keywords as HIGH risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: '请删除生产数据库中的用户表',
    description: '需要删表并同步处理生产环境'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.approvalRequired, true);
  assert.ok(
    result.factors.some((factor) =>
      factor.includes('destructive') || factor.includes('production') || factor.includes('database')
    )
  );
});

test('RiskAssessmentEngine - production keywords as HIGH risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Deploy to production',
    description: 'Release to live environment'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.approvalRequired, true);
  assert.ok(result.factors.some(f => f.includes('production')));
});

test('RiskAssessmentEngine - critical system keywords as HIGH risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Update core system',
    description: 'Modify critical authentication service'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.approvalRequired, true);
  assert.ok(result.factors.some(f => f.includes('critical') || f.includes('essential')));
});

test('RiskAssessmentEngine - database destructive operations as HIGH risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const dbInputs = [
    { title: 'Clean database', description: 'Truncate user sessions table' },
    { title: 'Schema update', description: 'ALTER TABLE users ADD COLUMN' },
    { title: 'Remove table', description: 'DROP TABLE old_data' },
    { title: 'Data cleanup', description: 'DELETE FROM logs WHERE date < 2024' }
  ];

  for (const input of dbInputs) {
    const result = engine.assess(input);
    assert.equal(result.riskLevel, 'HIGH');
    assert.equal(result.approvalRequired, true);
  }
});

test('RiskAssessmentEngine - advanced_discussion mode as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Design review',
    description: 'Review system architecture',
    executionMode: 'advanced_discussion'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
  assert.ok(result.factors.some(f => f.includes('advanced')));
});

test('RiskAssessmentEngine - require_sampling mode as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Multi-agent task',
    description: 'Coordinate work across agents',
    executionMode: 'require_sampling'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
});

test('RiskAssessmentEngine - urgent priority as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Fix bug',
    description: 'Address reported issue',
    priority: 'urgent'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
  assert.ok(result.factors.some(f => f.includes('urgency')));
});

test('RiskAssessmentEngine - critical priority as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Hotfix',
    description: 'Emergency patch',
    priority: 'critical'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
});

test('RiskAssessmentEngine - normal priority does not elevate risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Regular task',
    description: 'Standard work',
    priority: 'normal'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
});

test('RiskAssessmentEngine - refactor tasks as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Refactor auth module',
    description: 'Restructure authentication code',
    taskType: 'refactor'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
});

test('RiskAssessmentEngine - migration tasks as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Database migration',
    description: 'Migrate to new schema',
    taskType: 'migration'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
});

test('RiskAssessmentEngine - architecture tasks as MEDIUM risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Architecture review',
    description: 'Review system design'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'MEDIUM');
  assert.equal(result.approvalRequired, true);
});

test('RiskAssessmentEngine - add custom rule', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const customRule: RiskPolicyRule = {
    id: 'custom-rule',
    name: 'Custom Rule',
    enabled: true,
    condition: (input): boolean => input.title.toLowerCase().includes('secret'),
    riskLevel: 'HIGH',
    factor: 'Contains secret keyword',
    weight: 10
  };

  engine.addRule(customRule);

  const result = engine.assess({
    title: 'Access secret key',
    description: 'Get secret value'
  });

  assert.equal(result.riskLevel, 'HIGH');
  assert.ok(result.factors.includes('Contains secret keyword'));
});

test('RiskAssessmentEngine - remove rule', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const ruleCountBefore = engine.getRules().length;
  engine.removeRule('high-destructive-keywords');

  assert.equal(engine.getRules().length, ruleCountBefore - 1);

  const result = engine.assess({
    title: 'Delete everything',
    description: 'Remove all data'
  });

  // Should no longer be HIGH after removing destructive keyword rule
  assert.notEqual(result.riskLevel, 'HIGH');
});

test('RiskAssessmentEngine - disable rule', () => {
  const engine = createDefaultRiskAssessmentEngine();
  engine.disableRule('high-destructive-keywords');

  const rule = engine.getRule('high-destructive-keywords');
  assert.equal(rule?.enabled, false);

  const result = engine.assess({
    title: 'Delete everything',
    description: 'Remove all data'
  });

  // Should no longer be HIGH after disabling rule
  assert.notEqual(result.riskLevel, 'HIGH');
});

test('RiskAssessmentEngine - enable disabled rule', () => {
  const engine = createDefaultRiskAssessmentEngine();
  engine.disableRule('high-destructive-keywords');
  engine.enableRule('high-destructive-keywords');

  const rule = engine.getRule('high-destructive-keywords');
  assert.equal(rule?.enabled, true);

  const result = engine.assess({
    title: 'Delete everything',
    description: 'Remove all data'
  });

  assert.equal(result.riskLevel, 'HIGH');
});

test('RiskAssessmentEngine - get all rules', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const rules = engine.getRules();

  assert.ok(rules.length > 0);
  assert.ok(rules.every(r => r.id));
  assert.ok(rules.every(r => typeof r.enabled === 'boolean'));
});

test('RiskAssessmentEngine - get specific rule by ID', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const rule = engine.getRule('high-destructive-keywords');

  assert.ok(rule);
  assert.equal(rule?.id, 'high-destructive-keywords');
  assert.equal(rule?.name, 'Destructive Operation Keywords');
});

test('RiskAssessmentEngine - return undefined for non-existent rule', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const rule = engine.getRule('non-existent-rule');
  assert.equal(rule, undefined);
});

test('RiskAssessmentEngine - confidence between 0 and 1', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const result = engine.assess({
    title: 'Any task',
    description: 'Any description'
  });

  assert.ok(result.confidence >= 0);
  assert.ok(result.confidence <= 1);
});

test('RiskAssessmentEngine - handle empty input', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const result = engine.assess({
    title: '',
    description: ''
  });

  assert.equal(result.riskLevel, 'LOW');
  assert.equal(result.approvalRequired, false);
});

test('RiskAssessmentEngine - handle null/undefined optional fields', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const result = engine.assess({
    title: 'Some task',
    description: 'Some description',
    taskType: undefined,
    executionMode: undefined,
    priority: undefined
  });

  assert.ok(result.riskLevel);
  assert.ok(typeof result.approvalRequired === 'boolean');
});

test('RiskAssessmentEngine - handle rules that throw errors gracefully', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const badRule: RiskPolicyRule = {
    id: 'bad-rule',
    name: 'Bad Rule',
    enabled: true,
    condition: (): boolean => {
      throw new Error('Rule error');
    },
    riskLevel: 'HIGH',
    factor: 'Bad factor',
    weight: 10
  };

  engine.addRule(badRule);

  const result = engine.assess({
    title: 'Test',
    description: 'Test'
  });

  // Should not crash, should return result
  assert.ok(result.riskLevel);
});

test('RiskAssessmentEngine - case-insensitive keyword matching', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const variations = [
    { title: 'DELETE DATABASE', description: 'UPPERCASE' },
    { title: 'Delete Database', description: 'Title Case' },
    { title: 'delete database', description: 'lowercase' },
    { title: 'DeLeTe DaTaBaSe', description: 'MiXeD CaSe' }
  ];

  for (const input of variations) {
    const result = engine.assess(input);
    assert.equal(result.riskLevel, 'HIGH');
  }
});

test('RiskAssessmentEngine - query/get operations as LOW risk', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const queryInputs = [
    { title: 'Get user data', description: 'Fetch user profile' },
    { title: 'List all tasks', description: 'Show pending tasks' },
    { title: 'Query database', description: 'Read records' },
    { title: 'Fetch config', description: 'Display settings' },
    { title: 'Show status', description: 'Check system health' }
  ];

  for (const input of queryInputs) {
    const result = engine.assess(input);
    assert.equal(result.riskLevel, 'LOW');
    assert.equal(result.approvalRequired, false);
  }
});

test('RiskAssessmentEngine - prioritize destructive keywords over query keywords', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Get users then delete them',
    description: 'Fetch and remove user records'
  };

  const result = engine.assess(input);

  // Should be HIGH due to "delete" keyword, not LOW from "get"
  assert.equal(result.riskLevel, 'HIGH');
});

test('RiskAssessmentEngine - combine multiple risk factors', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const input: RiskAssessmentInput = {
    title: 'Delete production database',
    description: 'Drop critical tables in production',
    executionMode: 'advanced_discussion',
    priority: 'urgent'
  };

  const result = engine.assess(input);

  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.approvalRequired, true);
  // Should have multiple contributing factors
  assert.ok(result.factors.length > 1);
});

test('getDefaultRiskRules - returns array of rules', () => {
  const rules = getDefaultRiskRules();

  assert.ok(Array.isArray(rules));
  assert.ok(rules.length > 0);
});

test('getDefaultRiskRules - rules have all required properties', () => {
  const rules = getDefaultRiskRules();

  for (const rule of rules) {
    assert.ok(rule.id);
    assert.ok(rule.name);
    assert.ok(typeof rule.enabled === 'boolean');
    assert.ok(typeof rule.condition === 'function');
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(rule.riskLevel));
    assert.ok(rule.factor);
    assert.ok(typeof rule.weight === 'number');
  }
});

test('getDefaultRiskRules - includes HIGH risk rules', () => {
  const rules = getDefaultRiskRules();
  const highRules = rules.filter(r => r.riskLevel === 'HIGH');
  assert.ok(highRules.length > 0);
});

test('getDefaultRiskRules - includes MEDIUM risk rules', () => {
  const rules = getDefaultRiskRules();
  const mediumRules = rules.filter(r => r.riskLevel === 'MEDIUM');
  assert.ok(mediumRules.length > 0);
});

test('getDefaultRiskRules - includes LOW risk rules', () => {
  const rules = getDefaultRiskRules();
  const lowRules = rules.filter(r => r.riskLevel === 'LOW');
  assert.ok(lowRules.length > 0);
});

test('createDefaultRiskAssessmentEngine - creates engine with default rules', () => {
  const engine = createDefaultRiskAssessmentEngine();
  const rules = engine.getRules();

  assert.equal(rules.length, getDefaultRiskRules().length);
});

test('createDefaultRiskAssessmentEngine - assesses risk correctly', () => {
  const engine = createDefaultRiskAssessmentEngine();

  const lowResult = engine.assess({
    title: 'Read docs',
    description: 'Check documentation'
  });

  const highResult = engine.assess({
    title: 'Delete production database',
    description: 'Drop all tables'
  });

  assert.equal(lowResult.riskLevel, 'LOW');
  assert.equal(highResult.riskLevel, 'HIGH');
});
