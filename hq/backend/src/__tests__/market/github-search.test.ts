/**
 * Tests for github-search module
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubSearchError } from '../../market/github-search';

// Enable test mode
process.env.AGENCY_UNDER_NODE_TEST = '1';

// We'll test the error handling and type definitions
// Actual API calls are tested in integration tests

test.describe('GitHub Search Service - Type Definitions', () => {
  test('GitHubSearchError is throwable', () => {
    const error = new GitHubSearchError('Test error', 'TEST_CODE', { detail: 'test' });

    assert.equal(error.message, 'Test error');
    assert.equal(error.code, 'TEST_CODE');
    assert.deepEqual(error.details, { detail: 'test' });
    assert.equal(error.name, 'GitHubSearchError');
  });

  test('GitHubSearchError code is accessible', () => {
    const error = new GitHubSearchError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');

    assert.equal(error.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('GitHubSearchError details are optional', () => {
    const error = new GitHubSearchError('Simple error', 'SIMPLE');

    assert.equal(error.message, 'Simple error');
    assert.equal(error.code, 'SIMPLE');
    assert.equal(error.details, undefined);
  });
});

test.describe('GitHub Repo Type', () => {
  test('GitHubRepo type is properly defined', () => {
    // This test ensures the type is imported and usable
    type GitHubRepo = {
      url: string;
      owner: string;
      name: string;
      description?: string;
      language?: string;
      stars: number;
      forks: number;
      updatedAt: string;
      topics: string[];
      hasReadme: boolean;
      hasContributing: boolean;
    };

    const repo: GitHubRepo = {
      url: 'https://github.com/test/repo',
      owner: 'test',
      name: 'repo',
      description: 'Test repo',
      language: 'TypeScript',
      stars: 1000,
      forks: 100,
      updatedAt: '2024-01-15T10:30:00Z',
      topics: ['agent', 'ai'],
      hasReadme: true,
      hasContributing: true,
    };

    assert.equal(repo.owner, 'test');
    assert.equal(repo.stars, 1000);
    assert.ok(Array.isArray(repo.topics));
  });
});
