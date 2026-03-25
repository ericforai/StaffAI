import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export interface RuntimePaths {
  rootDir: string;
  configDir: string;
  cacheDir: string;
  hostCacheDir: string;
  discoveryCacheDir: string;
  sessionsDir: string;
  logsDir: string;
  generatedDir: string;
  executorsDir: string;
}

function expandHomeDir(inputPath: string): string {
  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function createRuntimePaths(rootOverride?: string): RuntimePaths {
  const rootDir = expandHomeDir(rootOverride || process.env.AGENCY_HOME || '~/.agency');
  const cacheDir = path.join(rootDir, 'cache');

  return {
    rootDir,
    configDir: path.join(rootDir, 'config'),
    cacheDir,
    hostCacheDir: path.join(cacheDir, 'hosts'),
    discoveryCacheDir: path.join(cacheDir, 'discovery'),
    sessionsDir: path.join(rootDir, 'sessions'),
    logsDir: path.join(rootDir, 'logs'),
    generatedDir: path.join(rootDir, 'generated'),
    executorsDir: path.join(rootDir, 'executors'),
  };
}

export async function ensureRuntimeState(runtime: RuntimePaths): Promise<void> {
  await Promise.all(
    [
      runtime.rootDir,
      runtime.configDir,
      runtime.cacheDir,
      runtime.hostCacheDir,
      runtime.discoveryCacheDir,
      runtime.sessionsDir,
      runtime.logsDir,
      runtime.generatedDir,
      runtime.executorsDir,
    ].map((dirPath) => fs.mkdir(dirPath, { recursive: true }))
  );
}

export async function writeRuntimeSnapshot<T>(runtime: RuntimePaths, fileName: string, payload: T): Promise<string> {
  const targetPath = path.join(runtime.discoveryCacheDir, fileName);
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf-8');
  return targetPath;
}

export async function readRuntimeSnapshot<T>(runtime: RuntimePaths, fileName: string): Promise<T | null> {
  const targetPath = path.join(runtime.discoveryCacheDir, fileName);

  try {
    const raw = await fs.readFile(targetPath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
