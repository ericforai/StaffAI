import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALLOWED_TOP_LEVEL_SOURCE_FILES,
  BACKEND_DEPENDENCY_RULES,
  getBackendSourceContext,
  normalizeBackendRelativePath,
  type BackendSourceContext,
} from '../architecture/backend-boundaries';

interface ImportEdge {
  sourceFile: string;
  sourceContext: BackendSourceContext;
  targetFile: string;
  targetContext: BackendSourceContext;
}

const BACKEND_SRC_ROOT = path.resolve(process.cwd(), 'src');
const alphabeticalSort = (left: string, right: string) => left.localeCompare(right);

function listSourceFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue;
      }
      collected.push(...listSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      collected.push(fullPath);
    }
  }

  return collected;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function extractImportSpecifiers(source: string): string[] {
  const sanitized = stripComments(source);
  const matches = sanitized.matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g);
  const specifiers: string[] = [];

  for (const match of matches) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolveImport(sourceFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(sourceFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function collectImportEdges(): ImportEdge[] {
  const files = listSourceFiles(BACKEND_SRC_ROOT);
  const edges: ImportEdge[] = [];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const specifiers = extractImportSpecifiers(source);
    const sourceContext = getBackendSourceContext(
      normalizeBackendRelativePath(path.relative(BACKEND_SRC_ROOT, filePath)),
    );

    for (const specifier of specifiers) {
      const resolved = resolveImport(filePath, specifier);
      if (!resolved) {
        continue;
      }

      if (!resolved.startsWith(BACKEND_SRC_ROOT)) {
        continue;
      }

      edges.push({
        sourceFile: path.relative(BACKEND_SRC_ROOT, filePath),
        sourceContext,
        targetFile: path.relative(BACKEND_SRC_ROOT, resolved),
        targetContext: getBackendSourceContext(
          normalizeBackendRelativePath(path.relative(BACKEND_SRC_ROOT, resolved)),
        ),
      });
    }
  }

  return edges;
}

function formatEdge(edge: ImportEdge): string {
  return `${edge.sourceFile} (${edge.sourceContext}) -> ${edge.targetFile} (${edge.targetContext})`;
}

test('backend bounded contexts do not import api from domain/runtime contexts', () => {
  const edges = collectImportEdges();
  const violations = [] as ImportEdge[];

  for (const rule of BACKEND_DEPENDENCY_RULES) {
    for (const edge of edges) {
      if (
        rule.sourceContexts.includes(edge.sourceContext) &&
        rule.forbiddenTargetContexts.includes(edge.targetContext)
      ) {
        violations.push(edge);
      }
    }
  }

  assert.deepEqual(
    violations.map(formatEdge),
    [],
  );
});

test('composition roots may assemble api routes without tripping the guard', () => {
  const edges = collectImportEdges();
  const compositionEdges = edges.filter((edge) =>
    edge.sourceFile === 'app/register-backend-routes.ts' && edge.targetContext === 'api',
  );

  assert.ok(
    compositionEdges.length > 0,
    'expected composition root to import api route handlers',
  );
  assert.ok(
    compositionEdges.every((edge) => edge.sourceContext === 'root'),
    `expected assembly file to stay classified as root, got ${compositionEdges.map(formatEdge).join(', ')}`,
  );
});

test('legacy root-level platform modules stay migrated into bounded contexts', () => {
  const topLevelSourceFiles = fs
    .readdirSync(BACKEND_SRC_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts'),
    )
    .map((entry) => entry.name)
    .sort(alphabeticalSort);

  assert.deepEqual(
    topLevelSourceFiles,
    Array.from(ALLOWED_TOP_LEVEL_SOURCE_FILES).sort(alphabeticalSort),
    `expected backend root to stay limited to approved entry files, found: ${topLevelSourceFiles.join(', ')}`,
  );
});
