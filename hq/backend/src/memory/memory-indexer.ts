import fs from 'node:fs';
import path from 'node:path';

export interface MemoryDocument {
  path: string;
  relativePath: string;
  content: string;
  modifiedAtMs: number;
}

function walkMarkdownFiles(rootDir: string, baseDir: string, output: string[]) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(absolutePath, baseDir, output);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
      continue;
    }

    output.push(path.relative(baseDir, absolutePath));
  }
}

export function indexMemoryDocuments(memoryRootDir: string): MemoryDocument[] {
  const files: string[] = [];
  walkMarkdownFiles(memoryRootDir, memoryRootDir, files);

  return files.map((relativePath) => {
    const absolutePath = path.join(memoryRootDir, relativePath);
    const stat = fs.statSync(absolutePath);
    return {
      path: absolutePath,
      relativePath,
      content: fs.readFileSync(absolutePath, 'utf8'),
      modifiedAtMs: stat.mtimeMs,
    };
  });
}
