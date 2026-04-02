import path from 'node:path';
import { Scanner } from '../scanner';
import { SkillScanner } from '../skill-scanner';
import { Store } from '../store';
import { DiscussionService } from './discussion-service';
import { DiscussionRuntime } from '../runtime/discussion-runtime';
import type { DashboardEvent } from '../observability/dashboard-events';
import type { ExecutorName, StartupCheckResult } from '../runtime/discussion-types';

type EventPublisher = (event: DashboardEvent) => void;

function useDiscussionStubRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.AGENCY_DISCUSSION_STUB === '1' ||
    process.env.AGENCY_UNDER_NODE_TEST === '1' ||
    process.argv.includes('--test')
  );
}

/** Fast path for `node --test` / CI so `/api/discussions/run` does not shell out to CLIs. */
function createStubDiscussionRuntime(): DiscussionRuntime {
  return {
    async getStartupCheck(): Promise<StartupCheckResult> {
      return {
        preferredExecutor: 'auto',
        effectiveDefaultExecutor: 'codex',
        executorAttemptOrder: ['codex'],
        discussionTimeoutMs: 30_000,
        overallReady: true,
        checks: [
          {
            name: 'codex',
            configured: true,
            available: true,
            status: 'ready',
            detail: 'stub',
          },
        ],
      };
    },
    async generateText(_systemPrompt: string, userPrompt: string): Promise<{ text: string; executor: ExecutorName }> {
      return {
        text: JSON.stringify({ response: `stub discussion reply for: ${userPrompt.slice(0, 200)}` }),
        executor: 'codex',
      };
    },
  } as unknown as DiscussionRuntime;
}

export function createDiscussionService(
  scanner: Scanner,
  _skillScanner: SkillScanner,
  store: Store,
  publish: EventPublisher,
) {
  const discussionRuntime = useDiscussionStubRuntime()
    ? createStubDiscussionRuntime()
    : new DiscussionRuntime({
        workspaceRoot: path.resolve(__dirname, '../../..'),
        claudePath:
          process.env.AGENCY_DISCUSSION_CLAUDE_PATH ||
          '/Users/user/.nvm/versions/node/v22.16.0/bin/claude',
        codexPath:
          process.env.AGENCY_DISCUSSION_CODEX_PATH ||
          '/Users/user/.nvm/versions/node/v22.16.0/bin/codex',
        geminiPath:
          process.env.AGENCY_DISCUSSION_GEMINI_PATH ||
          '/Users/user/.nvm/versions/node/v22.16.0/bin/gemini',
      });

  return new DiscussionService(scanner, store, publish, {
    runtime: discussionRuntime,
  });
}
