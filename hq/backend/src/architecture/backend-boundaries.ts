import path from 'node:path';

export type BackendSourceContext =
  | 'api'
  | 'orchestration'
  | 'runtime'
  | 'governance'
  | 'memory'
  | 'observability'
  | 'tools'
  | 'app'
  | 'root'
  | 'other';

export interface BackendDependencyRule {
  name: string;
  sourceContexts: readonly BackendSourceContext[];
  forbiddenTargetContexts: readonly BackendSourceContext[];
}

export const BACKEND_DEPENDENCY_RULES: BackendDependencyRule[] = [
  {
    name: 'runtime must not depend on api',
    sourceContexts: ['runtime'],
    forbiddenTargetContexts: ['api'],
  },
  {
    name: 'orchestration must not depend on api',
    sourceContexts: ['orchestration'],
    forbiddenTargetContexts: ['api'],
  },
  {
    name: 'governance/memory/observability/tools must not depend on api',
    sourceContexts: ['governance', 'memory', 'observability', 'tools'],
    forbiddenTargetContexts: ['api'],
  },
];

const COMPOSITION_ROOT_FILES = new Set([
  'app/create-discussion-service.ts',
  'app/register-backend-routes.ts',
  'mcp-server.ts',
  'server.ts',
  'web-server.ts',
]);

export function normalizeBackendRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

export function getBackendSourceContext(relativePath: string): BackendSourceContext {
  const normalizedPath = normalizeBackendRelativePath(relativePath);

  if (COMPOSITION_ROOT_FILES.has(normalizedPath)) {
    return 'root';
  }

  const [firstSegment] = normalizedPath.split('/');

  switch (firstSegment) {
    case 'api':
    case 'orchestration':
    case 'runtime':
    case 'governance':
    case 'memory':
    case 'observability':
    case 'tools':
    case 'app':
      return firstSegment;
    default:
      return 'other';
  }
}
