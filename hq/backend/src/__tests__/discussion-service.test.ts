import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscussionService } from '../discussion-service';
import type { StartupCheckResult } from '../discussion-service';
import type { ExecutorName } from '../runtime/discussion-types';

function createRuntime(status?: StartupCheckResult) {
  return {
    getStartupCheck: async () =>
      status ?? {
        preferredExecutor: 'claude',
        effectiveDefaultExecutor: 'claude',
        discussionTimeoutMs: 240000,
        overallReady: true,
        checks: [],
      },
    generateText: async () => ({ text: 'unused', executor: 'claude' as ExecutorName }),
  };
}

function createService(options?: {
  runtime?: ReturnType<typeof createRuntime>;
  workflowFacade?: { runDiscussion: (topic: string) => Promise<{ topic: string; participants: []; synthesis: string; executor: ExecutorName }> };
}) {
  const scanner = {
    getAllAgents: () => [],
    getAgent: () => undefined,
  };
  const store = {
    getActiveIds: () => [],
    save: () => undefined,
    searchKnowledge: () => [],
  };
  return new DiscussionService(
    scanner as never,
    store as never,
    () => undefined,
    {
      runtime: options?.runtime ?? createRuntime(),
      workflowFacade: options?.workflowFacade as never,
    },
  );
}

test('discussion service runDiscussionSummary maps synthesis to summary shape', async () => {
  const service = createService({
    workflowFacade: {
      runDiscussion: async () => ({
      topic: 'topic',
      participants: [],
      synthesis: 'synthesis-text',
      executor: 'codex',
      }),
    },
  });

  const result = await service.runDiscussionSummary('topic');
  assert.deepEqual(result, {
    summary: 'synthesis-text',
    executor: 'codex',
  });
});

test('discussion service getStartupCheck proxies runtime startup status', async () => {
  const mockedStatus: StartupCheckResult = {
    preferredExecutor: 'auto',
    effectiveDefaultExecutor: 'claude',
    discussionTimeoutMs: 240000,
    overallReady: true,
    checks: [],
  };
  const service = createService({
    runtime: createRuntime(mockedStatus),
  });

  const result = await service.getStartupCheck();
  assert.deepEqual(result, mockedStatus);
});
