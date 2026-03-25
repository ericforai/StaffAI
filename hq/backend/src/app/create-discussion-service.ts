import path from 'node:path';
import { Scanner } from '../scanner';
import { SkillScanner } from '../skill-scanner';
import { Store } from '../store';
import { DiscussionService } from '../discussion-service';
import { DiscussionRuntime } from '../runtime/discussion-runtime';
import type { DashboardEvent } from '../observability/dashboard-events';

type EventPublisher = (event: DashboardEvent) => void;

export function createDiscussionService(
  scanner: Scanner,
  _skillScanner: SkillScanner,
  store: Store,
  publish: EventPublisher
) {
  const discussionRuntime = new DiscussionRuntime({
    workspaceRoot: path.resolve(__dirname, '../../..'),
    claudePath:
      process.env.AGENCY_DISCUSSION_CLAUDE_PATH ||
      '/Users/user/.nvm/versions/node/v22.16.0/bin/claude',
    codexPath:
      process.env.AGENCY_DISCUSSION_CODEX_PATH ||
      '/Users/user/.nvm/versions/node/v22.16.0/bin/codex',
  });

  return new DiscussionService(scanner, store, publish, {
    runtime: discussionRuntime,
  });
}
