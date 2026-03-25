import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BACKEND_SRC_ROOT = path.resolve(process.cwd(), 'src');
const SERVER_FILE = path.join(BACKEND_SRC_ROOT, 'server.ts');

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

test('server.ts only depends on the web-server composition helper', () => {
  const source = fs.readFileSync(SERVER_FILE, 'utf8');
  const specifiers = extractImportSpecifiers(source);

  assert.deepEqual(specifiers, ['./app/create-web-server-runtime']);
});
