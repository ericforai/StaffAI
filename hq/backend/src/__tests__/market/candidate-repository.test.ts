/**
 * Tests for candidate-repository module
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import {
  createFileCandidateRepository,
  createInMemoryCandidateRepository,
  type Candidate,
  type CandidateRepository,
} from '../../market/candidate-repository';

// Enable test mode
process.env.AGENCY_UNDER_NODE_TEST = '1';

const TEST_FILE = `/tmp/candidates-test-${randomUUID()}.json`;

// Clean up before all tests
test.before(async () => {
  try {
    await fs.unlink(TEST_FILE);
  } catch {
    // Ignore if doesn't exist
  }
});

// Cleanup after tests
test.after(async () => {
  try {
    await fs.unlink(TEST_FILE);
  } catch {
    // Ignore if already deleted
  }
});

function createMockCandidate(overrides: Partial<Candidate> = {}): Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'> {
  const base: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'> = {
    url: 'https://github.com/test/repo',
    owner: 'test',
    name: 'repo',
    description: 'Test repository',
    language: 'TypeScript',
    score: {
      stars: 1000,
      forks: 100,
      lastUpdated: '2024-01-15T10:30:00Z',
    },
    topics: ['agent', 'ai'],
    evaluation: {
      score: 75,
      rating: 'recommended',
      tier: 'good',
      strengths: ['Active development', 'Good documentation'],
      concerns: [],
      evaluatedAt: '2024-01-15T10:30:00Z',
    },
    capability: {
      category: 'engineering',
      specialties: ['agent-framework'],
      description: 'AI agent framework',
      skills: ['TypeScript', 'Node.js'],
    },
    status: 'candidate',
    source: 'github',
  };

  return { ...base, ...overrides };
}

test.describe('FileCandidateRepository', () => {
  let repo: CandidateRepository;

  test.beforeEach(async () => {
    // Clean up test file before each test
    try {
      await fs.unlink(TEST_FILE);
    } catch {
      // Ignore if doesn't exist
    }
    repo = createFileCandidateRepository(TEST_FILE);
  });

  test('add creates new candidate with generated id', async () => {
    const candidate = createMockCandidate();
    const result = await repo.add(candidate);

    assert.ok(result.id);
    assert.ok(result.createdAt);
    assert.ok(result.updatedAt);
    assert.equal(result.name, 'repo');
    assert.equal(result.owner, 'test');
  });

  test('getById returns null for non-existent candidate', async () => {
    const result = await repo.getById('non-existent');
    assert.equal(result, null);
  });

  test('getById returns candidate by id', async () => {
    const candidate = createMockCandidate();
    const added = await repo.add(candidate);
    const found = await repo.getById(added.id);

    assert.notEqual(found, null);
    assert.equal(found!.id, added.id);
    assert.equal(found!.name, 'repo');
  });

  test('getByUrl finds candidate by URL (normalized)', async () => {
    const candidate = createMockCandidate({
      url: 'https://github.com/test/repo.git',
    });
    await repo.add(candidate);

    // Find with different URL format (should match after normalization)
    const found = await repo.getByUrl('https://GITHUB.COM/test/repo/');
    assert.notEqual(found, null);
    assert.equal(found!.name, 'repo');
  });

  test('getByUrl returns null for non-existent URL', async () => {
    const result = await repo.getByUrl('https://github.com/nonexistent/repo');
    assert.equal(result, null);
  });

  test('update modifies existing candidate', async () => {
    const candidate = createMockCandidate();
    const added = await repo.add(candidate);

    const updated = await repo.update(added.id, (c) => ({
      ...c,
      status: 'observing' as const,
    }));

    assert.notEqual(updated, null);
    assert.equal(updated!.status, 'observing');
  });

  test('update returns null for non-existent candidate', async () => {
    const result = await repo.update('non-existent', (c) => c);
    assert.equal(result, null);
  });

  test('delete removes candidate', async () => {
    const candidate = createMockCandidate();
    const added = await repo.add(candidate);

    const deleted = await repo.delete(added.id);
    assert.equal(deleted, true);

    const found = await repo.getById(added.id);
    assert.equal(found, null);
  });

  test('delete returns false for non-existent candidate', async () => {
    const result = await repo.delete('non-existent');
    assert.equal(result, false);
  });

  test('list returns all candidates', async () => {
    await repo.add(createMockCandidate({ name: 'repo1', url: 'https://github.com/test/repo1' }));
    await repo.add(createMockCandidate({ name: 'repo2', url: 'https://github.com/test/repo2' }));

    const candidates = await repo.list();
    assert.equal(candidates.length, 2);
  });

  test('list filters by source', async () => {
    await repo.add(createMockCandidate({ source: 'github', url: 'https://github.com/test/repo1' }));
    await repo.add(createMockCandidate({ source: 'npm', url: 'https://npmjs.com/test/repo2' }));

    const githubCandidates = await repo.list({ source: 'github' });
    assert.equal(githubCandidates.length, 1);
    assert.equal(githubCandidates[0].source, 'github');
  });

  test('list filters by language', async () => {
    await repo.add(createMockCandidate({ language: 'TypeScript', url: 'https://github.com/test/repo1' }));
    await repo.add(createMockCandidate({ language: 'Python', url: 'https://github.com/test/repo2' }));

    const tsCandidates = await repo.list({ language: 'TypeScript' });
    assert.equal(tsCandidates.length, 1);
    assert.equal(tsCandidates[0].language, 'TypeScript');
  });

  test('list filters by minStars', async () => {
    await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo1',
      score: { stars: 100, forks: 10, lastUpdated: '2024-01-15T10:30:00Z' },
    }));
    await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo2',
      score: { stars: 1000, forks: 100, lastUpdated: '2024-01-15T10:30:00Z' },
    }));

    const candidates = await repo.list({ minStars: 500 });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].score.stars, 1000);
  });

  test('list filters by topics', async () => {
    await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo1',
      topics: ['agent', 'ai'],
    }));
    await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo2',
      topics: ['web', 'frontend'],
    }));

    const candidates = await repo.list({ topics: ['agent'] });
    assert.equal(candidates.length, 1);
    assert.ok(candidates[0].topics.includes('agent'));
  });

  test('list applies pagination', async () => {
    await repo.add(createMockCandidate({ name: 'repo1', url: 'https://github.com/test/repo1' }));
    await repo.add(createMockCandidate({ name: 'repo2', url: 'https://github.com/test/repo2' }));
    await repo.add(createMockCandidate({ name: 'repo3', url: 'https://github.com/test/repo3' }));

    const candidates = await repo.list({ limit: 2, offset: 1 });
    assert.equal(candidates.length, 2);
  });

  test('list sorts by stars descending', async () => {
    await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo1',
      score: { stars: 100, forks: 10, lastUpdated: '2024-01-15T10:30:00Z' },
    }));
    await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo2',
      score: { stars: 1000, forks: 100, lastUpdated: '2024-01-15T10:30:00Z' },
    }));

    const candidates = await repo.list();
    assert.equal(candidates[0].score.stars, 1000);
    assert.equal(candidates[1].score.stars, 100);
  });

  test('add updates existing candidate with same URL', async () => {
    const candidate = createMockCandidate({
      url: 'https://github.com/test/repo.git', // with .git suffix
      score: { stars: 100, forks: 10, lastUpdated: '2024-01-15T10:30:00Z' },
    });

    const first = await repo.add(candidate);

    // Add same repo with different URL format
    const second = await repo.add(createMockCandidate({
      url: 'https://github.com/test/repo', // without .git
      score: { stars: 200, forks: 20, lastUpdated: '2024-01-16T10:30:00Z' },
    }));

    // Should be the same candidate (same ID)
    assert.equal(first.id, second.id);
    assert.equal(second.score.stars, 200); // Updated
  });

  test('addBatch handles multiple candidates with deduplication', async () => {
    const candidates = [
      createMockCandidate({ url: 'https://github.com/test/repo1', name: 'repo1' }),
      createMockCandidate({ url: 'https://github.com/test/repo2', name: 'repo2' }),
      createMockCandidate({ url: 'https://github.com/test/repo1', name: 'repo1-dup' }), // duplicate URL
    ];

    const results = await repo.addBatch(candidates);

    // addBatch returns a result for each input (new or merged)
    // But only 2 unique candidates should exist in storage
    assert.equal(results.length, 3);

    // Verify only 2 unique candidates in storage
    const stored = await repo.list();
    assert.equal(stored.length, 2);
  });

  test('persist data to file', async () => {
    const candidate = createMockCandidate();
    await repo.add(candidate);

    // Create new repository instance with same file
    const repo2 = createFileCandidateRepository(TEST_FILE);
    const candidates = await repo2.list();

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].name, 'repo');
  });
});

test.describe('InMemoryCandidateRepository', () => {
  let repo: CandidateRepository;

  test.beforeEach(() => {
    repo = createInMemoryCandidateRepository();
  });

  test.afterEach(() => {
    // Clean up by creating a new empty repo
    repo = createInMemoryCandidateRepository();
  });

  test('add and retrieve candidate', async () => {
    const candidate = createMockCandidate();
    const added = await repo.add(candidate);
    const found = await repo.getById(added.id);

    assert.notEqual(found, null);
    assert.equal(found!.id, added.id);
  });

  test('list returns all candidates', async () => {
    await repo.add(createMockCandidate({ name: 'repo1', url: 'https://github.com/test/repo1' }));
    await repo.add(createMockCandidate({ name: 'repo2', url: 'https://github.com/test/repo2' }));

    const candidates = await repo.list();
    assert.equal(candidates.length, 2);
  });

  test('update candidate', async () => {
    const candidate = createMockCandidate();
    const added = await repo.add(candidate);

    const updated = await repo.update(added.id, (c) => ({
      ...c,
      status: 'imported' as const,
    }));

    assert.equal(updated!.status, 'imported');
  });

  test('delete candidate', async () => {
    const candidate = createMockCandidate();
    const added = await repo.add(candidate);

    const deleted = await repo.delete(added.id);
    assert.equal(deleted, true);

    const found = await repo.getById(added.id);
    assert.equal(found, null);
  });

  test('addBatch with deduplication', async () => {
    const candidates = [
      createMockCandidate({ url: 'https://github.com/test/repo1', name: 'repo1' }),
      createMockCandidate({ url: 'https://github.com/test/repo2', name: 'repo2' }),
      createMockCandidate({ url: 'https://github.com/test/repo1', name: 'repo1-dup' }),
    ];

    const results = await repo.addBatch(candidates);

    // addBatch returns a result for each input (new or merged)
    assert.equal(results.length, 3);

    // But only 2 unique candidates should exist
    const stored = await repo.list();
    assert.equal(stored.length, 2);
  });
});

test.describe('URL Normalization', () => {
  test('normalizes URLs for deduplication', async () => {
    const repo = createInMemoryCandidateRepository();

    const urls = [
      'https://github.com/test/repo',
      'https://github.com/test/repo.git',
      'https://github.com/test/repo/',
      'https://GITHUB.COM/test/repo',
    ];

    for (const url of urls) {
      await repo.add(createMockCandidate({ url }));
    }

    const candidates = await repo.list();
    assert.equal(candidates.length, 1, 'All URLs should normalize to same candidate');
  });
});
