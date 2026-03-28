/**
 * Tests for candidate-evaluator module
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidate, type EvaluationInput, type CandidateEvaluation } from '../../market/candidate-evaluator';
import type { GitHubRepo } from '../../market/github-search';

// Enable test mode
process.env.AGENCY_UNDER_NODE_TEST = '1';

function createMockRepo(overrides?: Partial<GitHubRepo>): GitHubRepo {
  return {
    url: 'https://github.com/test/repo',
    owner: 'test',
    name: 'repo',
    description: 'Test repository',
    language: 'TypeScript',
    stars: 1000,
    forks: 100,
    updatedAt: '2024-01-15T10:30:00Z',
    topics: ['agent', 'ai', 'typescript'],
    hasReadme: true,
    hasContributing: true,
    ...overrides,
  };
}

test.describe('Candidate Evaluator', () => {
  test('returns evaluation with score 0-100', () => {
    const repo = createMockRepo();
    const input: EvaluationInput = { repo };
    const result = evaluateCandidate(input);

    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });

  test('high stars increase score', () => {
    const lowStarsRepo = createMockRepo({ stars: 10 });
    const highStarsRepo = createMockRepo({ stars: 10000 });

    const lowResult = evaluateCandidate({ repo: lowStarsRepo });
    const highResult = evaluateCandidate({ repo: highStarsRepo });

    assert.ok(highResult.score > lowResult.score,
      `High stars (${highResult.score}) should score higher than low stars (${lowResult.score})`
    );
  });

  test('recent activity increases score', () => {
    const oldRepo = createMockRepo({ updatedAt: '2020-01-15T10:30:00Z' });
    const newRepo = createMockRepo({ updatedAt: new Date().toISOString() });

    const oldResult = evaluateCandidate({ repo: oldRepo });
    const newResult = evaluateCandidate({ repo: newRepo });

    assert.ok(newResult.score > oldResult.score,
      `Recent activity (${newResult.score}) should score higher than old (${oldResult.score})`
    );
  });

  test('documentation presence increases score', () => {
    const noDocsRepo = createMockRepo({ hasReadme: false, hasContributing: false });
    const withDocsRepo = createMockRepo({ hasReadme: true, hasContributing: true });

    const noDocsResult = evaluateCandidate({ repo: noDocsRepo });
    const withDocsResult = evaluateCandidate({ repo: withDocsRepo });

    assert.ok(withDocsResult.score > noDocsResult.score,
      `With docs (${withDocsResult.score}) should score higher than without (${noDocsResult.score})`
    );
  });

  test('relevant topics increase score', () => {
    const irrelevantRepo = createMockRepo({ topics: ['web', 'frontend'] });
    const relevantRepo = createMockRepo({ topics: ['agent', 'ai', 'llm'] });

    const irrelevantResult = evaluateCandidate({ repo: irrelevantRepo });
    const relevantResult = evaluateCandidate({ repo: relevantRepo });

    assert.ok(relevantResult.score > irrelevantResult.score,
      `Relevant topics (${relevantResult.score}) should score higher`
    );
  });

  test('returns recommendation based on score', () => {
    const excellentRepo = createMockRepo({
      stars: 10000,
      forks: 1000,
      updatedAt: new Date().toISOString(),
      hasReadme: true,
      hasContributing: true,
      topics: ['agent', 'ai'],
    });

    const poorRepo = createMockRepo({
      stars: 5,
      forks: 0,
      updatedAt: '2020-01-15T10:30:00Z',
      hasReadme: false,
      hasContributing: false,
      topics: [],
    });

    const excellentResult = evaluateCandidate({ repo: excellentRepo });
    const poorResult = evaluateCandidate({ repo: poorRepo });

    assert.ok(excellentResult.score >= 60,
      `Excellent repo should have score >= 60, got ${excellentResult.score}`
    );
    assert.ok(excellentResult.recommendation === 'recommended' || excellentResult.recommendation === 'highly-recommended',
      `Excellent repo should be recommended, got ${excellentResult.recommendation}`
    );

    assert.ok(poorResult.score < 40,
      `Poor repo should have score < 40, got ${poorResult.score}`
    );
    assert.equal(poorResult.recommendation, 'not-recommended');
  });

  test('returns tier classification', () => {
    const excellentRepo = createMockRepo({
      stars: 10000,
      forks: 1000,
      updatedAt: new Date().toISOString(),
      hasReadme: true,
      hasContributing: true,
      topics: ['agent', 'ai'],
    });

    const result = evaluateCandidate({ repo: excellentRepo });

    assert.ok(['excellent', 'good', 'fair', 'poor'].includes(result.tier));
  });

  test('includes strengths for good candidates', () => {
    const goodRepo = createMockRepo({
      stars: 5000,
      forks: 500,
      updatedAt: new Date().toISOString(),
      hasReadme: true,
      hasContributing: true,
    });

    const result = evaluateCandidate({ repo: goodRepo });

    assert.ok(Array.isArray(result.strengths));
    assert.ok(result.strengths.length > 0, 'Good candidate should have strengths');
  });

  test('includes concerns for poor candidates', () => {
    const poorRepo = createMockRepo({
      stars: 5,
      forks: 0,
      updatedAt: '2020-01-15T10:30:00Z',
      hasReadme: false,
      hasContributing: false,
    });

    const result = evaluateCandidate({ repo: poorRepo });

    assert.ok(Array.isArray(result.concerns));
    assert.ok(result.concerns.length > 0, 'Poor candidate should have concerns');
  });

  test('evaluation includes recommendation', () => {
    const repo = createMockRepo();
    const result = evaluateCandidate({ repo });

    assert.ok(['highly-recommended', 'recommended', 'cautious', 'not-recommended'].includes(result.recommendation));
  });

  test('handles repo without description', () => {
    const repo = createMockRepo({ description: undefined });
    const result = evaluateCandidate({ repo });

    assert.ok(typeof result.score === 'number');
  });

  test('handles repo without topics', () => {
    const repo = createMockRepo({ topics: [] });
    const result = evaluateCandidate({ repo });

    assert.ok(typeof result.score === 'number');
  });

  test('handles repo without language', () => {
    const repo = createMockRepo({ language: undefined });
    const result = evaluateCandidate({ repo });

    assert.ok(typeof result.score === 'number');
  });

  test('score is deterministic for same input', () => {
    const repo = createMockRepo();

    const result1 = evaluateCandidate({ repo });
    const result2 = evaluateCandidate({ repo });

    assert.equal(result1.score, result2.score,
      'Score should be deterministic'
    );
  });

  test('forks contribute to score', () => {
    const noForksRepo = createMockRepo({ forks: 0 });
    const withForksRepo = createMockRepo({ forks: 200 });

    const noForksResult = evaluateCandidate({ repo: noForksRepo });
    const withForksResult = evaluateCandidate({ repo: withForksRepo });

    assert.ok(withForksResult.score > noForksResult.score,
      'Forks should contribute positively to score'
    );
  });

  test('rating thresholds work correctly', () => {
    // Test recommended threshold
    const excellentRepo = createMockRepo({
      stars: 10000,
      forks: 1000,
      updatedAt: new Date().toISOString(),
      hasReadme: true,
      hasContributing: true,
      topics: ['agent', 'ai'],
    });

    const excellentResult = evaluateCandidate({ repo: excellentRepo });
    assert.ok(excellentResult.score >= 60);
    assert.ok(excellentResult.recommendation === 'recommended' ||
              excellentResult.recommendation === 'highly-recommended');

    // Test not-recommended threshold
    const poorRepo = createMockRepo({
      stars: 0,
      forks: 0,
      updatedAt: '2020-01-01T00:00:00Z',
      hasReadme: false,
      hasContributing: false,
      topics: [],
    });

    const poorResult = evaluateCandidate({ repo: poorRepo });
    assert.ok(poorResult.score < 40);
    assert.equal(poorResult.recommendation, 'not-recommended');
  });
});
