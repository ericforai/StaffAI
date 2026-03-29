import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Scanner } from './scanner';
import { Store } from './store';
import { WebServer } from './server';
import { SkillScanner } from './skill-scanner';
import { createRuntimePaths, ensureRuntimeState } from './runtime/runtime-state';

async function loadDotEnvFile(filePath: string): Promise<void> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!key) {
        continue;
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing .env files.
  }
}

async function loadEnvironmentConfig(): Promise<void> {
  const backendEnv = path.resolve(__dirname, '../.env');
  const hqEnv = path.resolve(__dirname, '../../.env');
  await loadDotEnvFile(backendEnv);
  await loadDotEnvFile(hqEnv);
}

async function main() {
  await loadEnvironmentConfig();

  if (!process.env.AGENCY_DISCUSSION_EXECUTOR) {
    process.env.AGENCY_DISCUSSION_EXECUTOR = 'claude';
  }

  const runtimePaths = createRuntimePaths();
  await ensureRuntimeState(runtimePaths);
  console.log(`Runtime state ready at ${runtimePaths.rootDir}`);

  const scanner = new Scanner();
  await scanner.scan();
  console.log(`Scanned ${scanner.getAllAgents().length} agents.`);

  const skillScanner = new SkillScanner();
  await skillScanner.scan();
  console.log(`Scanned ${skillScanner.getAllSkills().length} skills.`);

  const store = new Store();
  const server = new WebServer(scanner, store, skillScanner);
  
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3333;
  await server.listen(port);
  console.log(`Backend fully initialized and listening on 0.0.0.0:${port}`);
  console.log(`Discussion executor default: ${process.env.AGENCY_DISCUSSION_EXECUTOR}`);
}

main().catch(console.error);
