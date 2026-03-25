import { Scanner } from './scanner';
import { Store } from './store';
import { WebServer } from './server';
import { SkillScanner } from './skill-scanner';
import { createRuntimePaths, ensureRuntimeState } from './runtime/runtime-state';

async function main() {
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
  server.start(port);
  console.log(`Backend fully initialized on 127.0.0.1:${port}`);
  console.log(`Discussion executor default: ${process.env.AGENCY_DISCUSSION_EXECUTOR}`);
}

main().catch(console.error);
